import { useRef, useState } from 'react';
import { api, MediaPost, Post } from '../api';
import { timeAgo, useApp } from '../store';
import { Avatar, Button, Card, CardHead, Empty, Field, Icon, Pill, Segmented, Sheet, Toggle } from '../ui';

type Tab = 'photo' | 'reel' | 'blog';

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });
}

async function shrinkPhoto(file: File): Promise<string> {
  const data = await fileToDataUrl(file);
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('That image could not be opened.'));
    img.src = data;
  });
  const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return data;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.82);
}

export default function MediaScreen() {
  const { data, run, toast, refresh } = useApp();
  const [tab, setTab] = useState<Tab>('photo');
  const [pending, setPending] = useState<{ kind: 'photo' | 'reel'; dataUrl: string } | null>(null);
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'circle'>('public');
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<MediaPost | null>(null);
  const [comment, setComment] = useState('');
  const [blogOpen, setBlogOpen] = useState(false);
  const [blogTitle, setBlogTitle] = useState('');
  const [blogBody, setBlogBody] = useState('');
  const [blogVisibility, setBlogVisibility] = useState<'public' | 'circle'>('public');
  const [openPost, setOpenPost] = useState<Post | null>(null);
  const [postComment, setPostComment] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);

  if (!data) return null;
  const media = data.media || [];
  const photos = media.filter((m) => m.kind === 'photo');
  const reels = media.filter((m) => m.kind === 'reel');
  const blogs = (data.posts || []).filter((p) => p.kind === 'blog');
  const minePhotos = photos.filter((m) => m.mine);
  const mineReels = reels.filter((m) => m.mine);

  function openPicker(kind: 'photo' | 'reel') {
    if (!fileRef.current) return;
    fileRef.current.accept = kind === 'photo' ? 'image/*' : 'video/*';
    fileRef.current.dataset.kind = kind;
    fileRef.current.value = '';
    fileRef.current.click();
  }

  async function onFile(file: File, kind: 'photo' | 'reel') {
    try {
      if (kind === 'photo') {
        if (file.size > 12 * 1024 * 1024) throw new Error('That photo is too large to start with. Keep it under 12 MB.');
        const dataUrl = await shrinkPhoto(file);
        setPending({ kind, dataUrl });
      } else {
        if (file.size > 15 * 1024 * 1024) throw new Error('Reels need to be under 15 MB. Trim it and try again.');
        const dataUrl = await fileToDataUrl(file);
        setPending({ kind, dataUrl });
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That file could not be read.', 'error');
    }
  }

  async function upload() {
    if (!pending) return;
    setBusy(true);
    try {
      await api('/media', {
        method: 'POST',
        body: { kind: pending.kind, dataUrl: pending.dataUrl, caption, visibility },
      });
      setPending(null);
      setCaption('');
      await refresh();
      toast(pending.kind === 'photo' ? 'Photo posted.' : 'Reel posted.', 'ok');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Upload failed.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function postBlog() {
    setBusy(true);
    try {
      await api('/posts', {
        method: 'POST',
        body: { kind: 'blog', title: blogTitle, body: blogBody, visibility: blogVisibility },
      });
      setBlogOpen(false);
      setBlogTitle('');
      setBlogBody('');
      await refresh();
      toast('Blog posted.', 'ok');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not post that.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen">
      <div className="section-head">
        <div>
          <h1 className="section-title">Photos & reels</h1>
          <p className="section-sub">
            Keep a record of your life that is not only the hard parts. Each photo and reel has a caption,
            comments, and a choice: public, or only people in your circle.
          </p>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          const kind = (e.target.dataset.kind as 'photo' | 'reel') || 'photo';
          if (file) void onFile(file, kind);
        }}
      />

      <Segmented
        options={[
          { value: 'photo', label: 'Photos', badge: photos.length },
          { value: 'reel', label: 'Reels', badge: reels.length },
          { value: 'blog', label: 'Blog', badge: blogs.length },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'photo' ? (
        <Card>
          <CardHead
            title="Photos"
            hint="Caption them. A photo with a story is harder to lose."
            icon="camera"
            action={
              <div className="row" style={{ gap: 8 }}>
                <Pill>{minePhotos.length}/25 yours</Pill>
                <Button size="sm" icon="plus" onClick={() => openPicker('photo')}>
                  Add photo
                </Button>
              </div>
            }
          />
          {photos.length === 0 ? (
            <Empty
              icon="camera"
              title="No photos yet"
              body="Post the first one. A view, a meal, a person, a doorway that meant something."
              action={
                <Button size="sm" onClick={() => openPicker('photo')}>
                  Choose a photo
                </Button>
              }
            />
          ) : (
            <div className="media-grid">
              {photos.map((m) => (
                <button key={m.id} className="media-tile" onClick={() => setDetail(m)}>
                  <img src={`/api/media/file/${m.id}`} alt={m.caption || `Photo by ${m.author.name}`} loading="lazy" />
                  <div className="media-cap">{m.caption || 'No caption'}</div>
                  <div className="media-by">
                    {m.author.name.split(' ')[0]} · {timeAgo(m.at)} · {m.visibility === 'circle' ? 'circle only' : 'public'}
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>
      ) : null}

      {tab === 'reel' ? (
        <Card>
          <CardHead
            title="Reels"
            hint="Short videos, under 15 MB. Caption first, film second — or the other way round."
            icon="play"
            action={
              <div className="row" style={{ gap: 8 }}>
                <Pill>{mineReels.length}/8 yours</Pill>
                <Button size="sm" icon="plus" onClick={() => openPicker('reel')}>
                  Add reel
                </Button>
              </div>
            }
          />
          {reels.length === 0 ? (
            <Empty
              icon="play"
              title="No reels yet"
              body="A dish shift, a walk to the river, a room you finally got. Sixty seconds is enough."
              action={
                <Button size="sm" onClick={() => openPicker('reel')}>
                  Choose a video
                </Button>
              }
            />
          ) : (
            <div className="stack">
              {reels.map((m) => (
                <div key={m.id} className="media-full">
                  <div className="row" style={{ gap: 10, marginBottom: 8 }}>
                    <Avatar name={m.author.name} color={m.author.avatarColor} size={34} />
                    <div className="grow">
                      <div className="small strong">{m.author.name}</div>
                      <div className="tiny muted">{timeAgo(m.at)} · {m.visibility === 'circle' ? 'circle only' : 'public'}</div>
                    </div>
                    <Pill tone="mint" icon="play">reel</Pill>
                  </div>
                  <video src={`/api/media/file/${m.id}`} controls playsInline poster="" />
                  <p className="small" style={{ marginTop: 8, lineHeight: 1.5 }}>{m.caption}</p>
                  <div className="row wrap" style={{ gap: 8 }}>
                    <Button
                      size="sm"
                      variant={m.liked ? 'mint' : 'quiet'}
                      icon="heart"
                      onClick={() => void run(() => api(`/media/${m.id}/like`, { method: 'POST' }))}
                    >
                      {m.likesCount}
                    </Button>
                    <Button size="sm" variant="quiet" icon="comment" onClick={() => setDetail(m)}>
                      {m.comments.length}
                    </Button>
                    <Button
                      size="sm"
                      variant="quiet"
                      icon="share"
                      onClick={async () => {
                        await api(`/media/${m.id}/share`, { method: 'POST' });
                        const url = `${location.origin}/api/media/file/${m.id}`;
                        if (navigator.share) void navigator.share({ title: 'Northlight reel', text: m.caption, url }).catch(() => undefined);
                        else void navigator.clipboard.writeText(url).then(() => toast('Link copied.', 'ok'), () => undefined);
                      }}
                    >
                      Share
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      ) : null}

      {tab === 'blog' ? (
        <Card>
          <CardHead
            title="Blog"
            hint="Longer than a caption. No word limit worth worrying about."
            icon="news"
            action={
              <Button size="sm" icon="plus" onClick={() => setBlogOpen(true)}>
                Write
              </Button>
            }
          />
          {blogs.length === 0 ? (
            <Empty
              icon="news"
              title="Nothing written yet"
              body="Write about the week, the weather, a door that opened. Public, or just your circle."
              action={
                <Button size="sm" onClick={() => setBlogOpen(true)}>
                  Write the first post
                </Button>
              }
            />
          ) : (
            <div className="stack">
              {blogs.map((p) => (
                <article key={p.id} className="story-card">
                  <div className="row" style={{ gap: 10 }}>
                    <Avatar name={p.author.name} color={p.author.avatarColor} size={34} />
                    <div className="grow">
                      <div className="small strong">{p.author.name}</div>
                      <div className="tiny muted">{timeAgo(p.at)} · {p.visibility === 'circle' ? 'circle only' : 'public'}</div>
                    </div>
                    <Pill tone="warm">blog</Pill>
                  </div>
                  <h2>{p.title}</h2>
                  <p>{p.body}</p>
                  <div className="row wrap" style={{ gap: 8, marginTop: 10 }}>
                    <Button
                      size="sm"
                      variant={p.cheered ? 'mint' : 'quiet'}
                      icon="heart"
                      onClick={() => void run(() => api(`/posts/${p.id}/like`, { method: 'POST' }))}
                    >
                      {p.cheersCount}
                    </Button>
                    <Button size="sm" variant="quiet" icon="comment" onClick={() => setOpenPost(p)}>
                      {p.comments.length} comments
                    </Button>
                    <Button
                      size="sm"
                      variant="quiet"
                      icon="share"
                      onClick={async () => {
                        await api(`/posts/${p.id}/share`, { method: 'POST' });
                        toast('Shared. The count is on the post.', 'ok');
                        await refresh();
                      }}
                    >
                      Share
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon="send"
                      onClick={async () => {
                        const text = `${p.title}\n\n${p.body}`;
                        if (navigator.share) void navigator.share({ title: p.title, text }).catch(() => undefined);
                        else void navigator.clipboard.writeText(text).then(() => toast('Copied.', 'ok'), () => undefined);
                      }}
                    >
                      Send
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </Card>
      ) : null}

      {/* upload composer */}
      <Sheet
        open={!!pending}
        onClose={() => setPending(null)}
        title={pending?.kind === 'reel' ? 'New reel' : 'New photo'}
        footer={
          <Button full icon="check" disabled={busy} onClick={() => void upload()}>
            {busy ? 'Uploading…' : 'Post it'}
          </Button>
        }
      >
        {pending ? (
          <div className="stack">
            {pending.kind === 'photo' ? (
              <img src={pending.dataUrl} alt="Preview" style={{ width: '100%', borderRadius: 12 }} />
            ) : (
              <video src={pending.dataUrl} controls style={{ width: '100%', borderRadius: 12 }} />
            )}
            <Field label="Caption" hint="Where was it? What was happening? A sentence is plenty.">
              <textarea
                className="textarea"
                rows={3}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                maxLength={600}
                placeholder="The river at 6:40 this morning…"
              />
            </Field>
            <Toggle
              label="Only my circle can see this"
              description="Public posts are visible to signed-in Northlight members. Circle posts only to people you accepted."
              checked={visibility === 'circle'}
              onChange={(next) => setVisibility(next ? 'circle' : 'public')}
            />
          </div>
        ) : null}
      </Sheet>

      {/* media detail */}
      <Sheet open={!!detail} onClose={() => setDetail(null)} title={detail?.caption ? 'Post' : 'Photo'}>
        {detail ? (
          <div className="stack media-full">
            {detail.kind === 'photo' || detail.seedArt ? (
              <img src={`/api/media/file/${detail.id}`} alt={detail.caption || 'Photo'} />
            ) : (
              <video src={`/api/media/file/${detail.id}`} controls playsInline />
            )}
            <div className="row" style={{ gap: 10 }}>
              <Avatar name={detail.author.name} color={detail.author.avatarColor} size={34} />
              <div className="grow">
                <div className="small strong">{detail.author.name}</div>
                <div className="tiny muted">
                  {timeAgo(detail.at)} · {detail.visibility === 'circle' ? 'circle only' : 'public'}
                </div>
              </div>
              {detail.mine ? (
                <Button
                  size="sm"
                  variant="ghost"
                  icon="trash"
                  onClick={async () => {
                    if (!confirm('Delete this post for good?')) return;
                    const ok = await run(() => api(`/media/${detail.id}`, { method: 'DELETE' }), 'Deleted.');
                    if (ok) setDetail(null);
                  }}
                >
                  Delete
                </Button>
              ) : null}
            </div>
            <p className="small" style={{ lineHeight: 1.55 }}>{detail.caption}</p>
            <div className="row wrap" style={{ gap: 8 }}>
              <Button
                size="sm"
                variant={detail.liked ? 'mint' : 'quiet'}
                icon="heart"
                onClick={() => void run(() => api(`/media/${detail.id}/like`, { method: 'POST' }))}
              >
                {detail.likesCount} love
              </Button>
              <Button
                size="sm"
                variant="quiet"
                icon="share"
                onClick={async () => {
                  await api(`/media/${detail.id}/share`, { method: 'POST' });
                  const url = `${location.origin}/api/media/file/${detail.id}`;
                  if (navigator.share) void navigator.share({ title: 'Northlight', url }).catch(() => undefined);
                  else void navigator.clipboard.writeText(url).then(() => toast('Link copied.', 'ok'), () => undefined);
                  await refresh();
                }}
              >
                Share ({detail.shares})
              </Button>
            </div>

            <div className="divider">comments</div>
            {detail.comments.length === 0 ? (
              <p className="small muted">No comments yet.</p>
            ) : (
              <div className="stack-tight">
                {detail.comments.map((c) => (
                  <div key={c.id} className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
                    <Avatar name={c.name} color={c.avatarColor} size={28} />
                    <div className="grow">
                      <div className="tiny strong">{c.name} · {timeAgo(c.at)}</div>
                      <div className="small">{c.body}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <form
              className="row"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!comment.trim()) return;
                const ok = await run(() => api(`/media/${detail.id}/comment`, { method: 'POST', body: { body: comment } }), 'Comment added.');
                if (ok) {
                  setComment('');
                  const res = await api<{ media: MediaPost[] }>('/media').catch(() => null);
                  if (res) {
                    const found = res.media.find((m) => m.id === detail.id);
                    if (found) setDetail(found);
                  }
                }
              }}
            >
              <input
                className="input grow"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Say something kind…"
                maxLength={600}
              />
              <Button type="submit" icon="send" disabled={!comment.trim()} />
            </form>
          </div>
        ) : null}
      </Sheet>

      {/* blog composer */}
      <Sheet
        open={blogOpen}
        onClose={() => setBlogOpen(false)}
        title="Write a blog post"
        footer={
          <Button full icon="check" disabled={busy || blogTitle.trim().length < 3 || blogBody.trim().length < 10} onClick={() => void postBlog()}>
            {busy ? 'Posting…' : 'Post'}
          </Button>
        }
      >
        <Field label="Title">
          <input className="input" value={blogTitle} onChange={(e) => setBlogTitle(e.target.value)} maxLength={120} placeholder="The week I stopped hiding it" />
        </Field>
        <Field label="Your post" hint="Whatever you want to say. You can edit your mind later.">
          <textarea className="textarea" rows={9} value={blogBody} onChange={(e) => setBlogBody(e.target.value)} maxLength={8000} />
        </Field>
        <Toggle
          label="Only my circle can read this"
          checked={blogVisibility === 'circle'}
          onChange={(next) => setBlogVisibility(next ? 'circle' : 'public')}
        />
      </Sheet>

      {/* blog comments */}
      <Sheet open={!!openPost} onClose={() => setOpenPost(null)} title={openPost?.title || 'Post'}>
        {openPost ? (
          <div className="stack">
            <p className="small" style={{ lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{openPost.body}</p>
            <div className="divider">comments</div>
            {openPost.comments.length === 0 ? (
              <p className="small muted">No comments yet.</p>
            ) : (
              <div className="stack-tight">
                {openPost.comments.map((c) => (
                  <div key={c.id} className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
                    <Avatar name={c.name} color={c.avatarColor} size={28} />
                    <div className="grow">
                      <div className="tiny strong">{c.name} · {timeAgo(c.at)}</div>
                      <div className="small">{c.body}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <form
              className="row"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!postComment.trim()) return;
                const ok = await run(
                  () => api(`/posts/${openPost.id}/comment`, { method: 'POST', body: { body: postComment } }),
                  'Comment added.'
                );
                if (ok) {
                  setPostComment('');
                  setOpenPost(null);
                }
              }}
            >
              <input
                className="input grow"
                value={postComment}
                onChange={(e) => setPostComment(e.target.value)}
                placeholder="Add a comment…"
              />
              <Button type="submit" icon="send" disabled={!postComment.trim()} />
            </form>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
