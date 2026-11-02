import { useState } from 'react';
import { api } from '../api';
import { timeAgo, useApp } from '../store';
import { Avatar, Button, Card, CardHead, Empty, Field, Icon, Pill, Progress, Segmented, Sheet, Toggle } from '../ui';
import { Go } from '../nav';
import PostCard from '../PostCard';

const KINDS = [
  { value: 'need', label: 'Needs', hint: 'Things that would get you through this week.' },
  { value: 'want', label: 'Wants', hint: 'Not survival — the small comforts that make you a person.' },
  { value: 'goal', label: 'Goals', hint: 'Concrete, with progress you can move.' },
  { value: 'dream', label: 'Dreams', hint: 'The long one. Write it down even if it scares you.' },
  { value: 'wish', label: 'Wishlist', hint: 'One specific thing someone could actually give or do.' },
] as const;

type Kind = (typeof KINDS)[number]['value'];

export default function MeScreen({ go }: { go: Go }) {
  const { data, run, logout, toast } = useApp();
  const [kind, setKind] = useState<Kind>('need');
  const [newTitle, setNewTitle] = useState('');
  const [newNote, setNewNote] = useState('');
  const [adding, setAdding] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [storyOpen, setStoryOpen] = useState(false);
  const [form, setForm] = useState({ name: '', bio: '', story: '', passions: '', highSchool: '', college: '', gradYear: '' });
  const [post, setPost] = useState({ kind: 'story' as 'story' | 'passion', title: '', body: '', tags: '' });
  const [busy, setBusy] = useState(false);

  if (!data) return null;
  const me = data.me;
  const items = data.items.filter((i) => i.kind === kind);
  const active = KINDS.find((k) => k.value === kind)!;
  const myPosts = data.posts.filter((p) => p.author.handle === me.handle);

  function openEdit() {
    setForm({
      name: me.name,
      bio: me.bio,
      story: me.story,
      passions: (me.passions || []).join(', '),
      highSchool: me.highSchool,
      college: me.college,
      gradYear: me.gradYear,
    });
    setEditOpen(true);
  }

  async function saveProfile() {
    setBusy(true);
    const ok = await run(
      () =>
        api('/me', {
          method: 'PATCH',
          body: {
            ...form,
            passions: form.passions
              .split(',')
              .map((p) => p.trim())
              .filter(Boolean),
          },
        }),
      'Saved.'
    );
    setBusy(false);
    if (ok) setEditOpen(false);
  }

  async function addItem() {
    if (newTitle.trim().length < 3) return;
    setBusy(true);
    const ok = await run(
      () => api('/items', { method: 'POST', body: { kind, title: newTitle, note: newNote } }),
      'Added to your list.'
    );
    setBusy(false);
    if (ok) {
      setNewTitle('');
      setNewNote('');
      setAdding(false);
    }
  }

  async function publishPost() {
    if (post.title.trim().length < 3 || post.body.trim().length < 10) {
      toast('A title and a couple of sentences, at least.', 'error');
      return;
    }
    setBusy(true);
    const ok = await run(
      () =>
        api('/posts', {
          method: 'POST',
          body: {
            kind: post.kind,
            title: post.title,
            body: post.body,
            tags: post.tags.split(',').map((t) => t.trim()).filter(Boolean),
          },
        }),
      'Posted. People can cheer this on now.'
    );
    setBusy(false);
    if (ok) {
      setPost({ kind: 'story', title: '', body: '', tags: '' });
      setStoryOpen(false);
    }
  }

  return (
    <div className="screen">
      <Card>
        <div className="profile-head" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <Avatar name={me.name} color={me.avatarColor} size={68} ring />
          <div className="grow">
            <h1 className="display" style={{ fontSize: '1.55rem', lineHeight: 1.15 }}>
              {me.name}
            </h1>
            <div className="tiny muted">@{me.handle}</div>
            <div className="row wrap" style={{ marginTop: 8 }}>
              {me.highSchool ? <Pill>{me.highSchool}</Pill> : null}
              {me.college ? <Pill>{me.college}</Pill> : null}
              {me.gradYear ? <Pill>{me.gradYear}</Pill> : null}
            </div>
          </div>
          <Button size="sm" variant="ghost" icon="user" onClick={openEdit}>
            Edit
          </Button>
        </div>

        {me.bio ? (
          <p className="small" style={{ marginTop: 14, lineHeight: 1.6, color: '#d3e0e5' }}>
            {me.bio}
          </p>
        ) : (
          <p className="small muted" style={{ marginTop: 14 }}>
            Add a short bio so classmates recognise you.
          </p>
        )}

        {me.passions.length > 0 ? (
          <div className="row wrap" style={{ gap: 6, marginTop: 12 }}>
            {me.passions.map((p) => (
              <Pill key={p} tone="amber">
                {p}
              </Pill>
            ))}
          </div>
        ) : null}

        <div className="stat-row" style={{ marginTop: 16 }}>
          <div className="stat">
            <b>{data.items.filter((i) => !i.done).length}</b>
            <span>Open items</span>
          </div>
          <div className="stat">
            <b>{data.circle.length}</b>
            <span>Circle</span>
          </div>
          <div className="stat">
            <b>{myPosts.length}</b>
            <span>Posts</span>
          </div>
        </div>
      </Card>

      <div className="wide-grid">
        <div className="stack">
          <Card>
            <CardHead
              title="Your lists"
              hint={active.hint}
              icon="spark"
              action={
                <Button size="sm" variant="ghost" icon="plus" onClick={() => setAdding((a) => !a)}>
                  Add
                </Button>
              }
            />
            <Segmented
              small
              options={KINDS.map((k) => ({
                value: k.value,
                label: k.label,
                badge: data.items.filter((i) => i.kind === k.value && !i.done).length,
              }))}
              value={kind}
              onChange={(v) => setKind(v as Kind)}
            />

            {adding ? (
              <form
                className="stack-tight"
                style={{ marginTop: 14 }}
                onSubmit={(e) => {
                  e.preventDefault();
                  void addItem();
                }}
              >
                <Field label={`New ${active.label.toLowerCase().replace(/s$/, '')}`} htmlFor="item-title">
                  <input
                    id="item-title"
                    className="input"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder={kind === 'wish' ? 'A chef knife of my own' : 'What is it?'}
                    autoFocus
                  />
                </Field>
                <Field label="Details" htmlFor="item-note" hint="Why it matters, or how someone could help.">
                  <textarea
                    id="item-note"
                    className="textarea"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Any extra detail."
                    style={{ minHeight: 76 }}
                  />
                </Field>
                <div className="row">
                  <Button type="submit" size="sm" disabled={busy}>
                    Add it
                  </Button>
                  <Button size="sm" variant="quiet" onClick={() => setAdding(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            ) : null}

            <div className="stack-tight" style={{ marginTop: 14 }}>
              {items.length === 0 ? (
                <Empty
                  icon="spark"
                  title={`No ${active.label.toLowerCase()} yet`}
                  body={active.hint}
                  action={
                    <Button size="sm" variant="ghost" onClick={() => setAdding(true)}>
                      Write the first one
                    </Button>
                  }
                />
              ) : (
                items.map((i) => (
                  <div key={i.id} className="list-item">
                    <button
                      className={`list-check ${i.done ? 'is-done' : ''}`}
                      onClick={() =>
                        void run(() =>
                          api(`/items/${i.id}`, { method: 'PATCH', body: { done: !i.done } })
                        )
                      }
                      aria-label={i.done ? 'Mark as not done' : 'Mark as done'}
                    >
                      <Icon name="check" size={15} />
                    </button>
                    <div className="grow">
                      <div className={`list-title ${i.done ? 'is-done' : ''}`}>{i.title}</div>
                      {i.note ? <div className="list-note">{i.note}</div> : null}
                      {i.kind === 'goal' || i.kind === 'dream' ? (
                        <div style={{ marginTop: 8 }}>
                          <Progress value={i.progress} tone="mint" />
                          <div className="row-between" style={{ marginTop: 6 }}>
                            <span className="tiny muted">{i.progress}% there</span>
                            <div className="row" style={{ gap: 6 }}>
                              <button
                                className="chip"
                                onClick={() =>
                                  void run(() =>
                                    api(`/items/${i.id}`, {
                                      method: 'PATCH',
                                      body: { progress: Math.max(0, i.progress - 10) },
                                    })
                                  )
                                }
                              >
                                −10%
                              </button>
                              <button
                                className="chip"
                                onClick={() =>
                                  void run(() =>
                                    api(`/items/${i.id}`, {
                                      method: 'PATCH',
                                      body: { progress: Math.min(100, i.progress + 10) },
                                    })
                                  )
                                }
                              >
                                +10%
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : null}
                      {i.claimedBy ? (
                        <div style={{ marginTop: 8 }}>
                          <Pill tone="mint" icon="heart">
                            Someone offered to help
                          </Pill>
                        </div>
                      ) : null}
                    </div>
                    <button
                      className="icon-btn"
                      onClick={() => {
                        if (!confirm('Remove this from your list?')) return;
                        void run(() => api(`/items/${i.id}`, { method: 'DELETE' }), 'Removed.');
                      }}
                      aria-label="Delete item"
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>

            <p className="field-hint" style={{ marginTop: 12 }}>
              Needs and wishes are visible to people in Northlight who can help. Your location never is.
            </p>
          </Card>

          <Card>
            <CardHead
              title="Your story & passions"
              hint="What you carry, and what you are good at. People hire from here."
              icon="spark"
              action={
                <Button size="sm" variant="ghost" icon="plus" onClick={() => setStoryOpen(true)}>
                  Post
                </Button>
              }
            />
            {me.story ? (
              <div className="post">
                <h3 className="post-title">Your story</h3>
                <p className="post-body">{me.story}</p>
                <Button size="sm" variant="quiet" onClick={openEdit}>
                  Edit your story
                </Button>
              </div>
            ) : (
              <Empty
                icon="spark"
                title="Your story is not written yet"
                body="Two honest sentences is enough. Nobody here is grading you."
                action={
                  <Button size="sm" onClick={openEdit}>
                    Write it
                  </Button>
                }
              />
            )}

            <div style={{ marginTop: 12 }}>
              {myPosts.length === 0 ? (
                <p className="small muted">You have not posted to the circle yet.</p>
              ) : (
                myPosts.map((p) => <PostCard key={p.id} post={p} compact />)
              )}
            </div>
          </Card>
        </div>

        <div className="stack">
          <Card>
            <CardHead title="Privacy" hint="Two switches. That is the whole system." icon="shield" />
            <Toggle
              label="Share my location"
              description={me.shareLocation ? 'Your circle can see your current spot.' : 'Off — nobody can see where you are.'}
              checked={me.shareLocation}
              onChange={(next) =>
                void run(() =>
                  api('/location/settings', { method: 'PATCH', body: { shareLocation: next } })
                )
              }
            />
            <Toggle
              label="Keep a last known spot"
              description="When sharing is off, your circle can still see where you last checked in — without a live location."
              checked={me.shareLastKnown}
              onChange={(next) =>
                void run(() =>
                  api('/location/settings', { method: 'PATCH', body: { shareLastKnown: next } })
                )
              }
            />
            <div style={{ marginTop: 14 }}>
              <Button size="sm" variant="ghost" icon="pin" onClick={() => go('spot')}>
                Open my spot
              </Button>
            </div>
          </Card>

          <Card>
            <CardHead title="Invite someone" hint="Family, or the friend you lost touch with." icon="send" />
            <div className="row-between">
              <code
                style={{
                  fontFamily: 'ui-monospace, monospace',
                  letterSpacing: '0.08em',
                  color: 'var(--amber-soft)',
                  fontSize: '1.05rem',
                }}
              >
                {me.inviteCode}
              </code>
              <Button size="sm" variant="ghost" onClick={() => go('circle')}>
                Share
              </Button>
            </div>
            <p className="field-hint" style={{ marginTop: 10 }}>
              They type this code, or you can search them by name and school in your circle.
            </p>
          </Card>

          <Card>
            <CardHead title="Account" icon="user" />
            <p className="small muted" style={{ lineHeight: 1.55 }}>
              Handle <b style={{ color: 'var(--text)' }}>@{me.handle}</b> · joined {timeAgo(me.createdAt)}.
              {' '}No email or phone number is stored on this account.
            </p>
            <div style={{ marginTop: 12 }} className="stack-tight">
              <Button variant="ghost" size="sm" icon="phone" onClick={openEdit}>
                Edit profile
              </Button>
              <Button variant="quiet" size="sm" icon="lock" onClick={() => void logout()}>
                Sign out
              </Button>
            </div>
          </Card>

          <div className="note-box">
            <b>About Northlight.</b> Built with people who have slept outside. If something here makes you
            feel watched, tell us — a person reads every message sent to the Northlight Guide.
          </div>
        </div>
      </div>

      <Sheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit your profile"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button full onClick={() => void saveProfile()} disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        <Field label="Name" htmlFor="p-name">
          <input
            id="p-name"
            className="input"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </Field>
        <Field label="Short bio" htmlFor="p-bio" hint="What you do, what you are good at.">
          <textarea
            id="p-bio"
            className="textarea"
            value={form.bio}
            onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
            style={{ minHeight: 80 }}
          />
        </Field>
        <Field label="Your story" htmlFor="p-story" hint="This is public to Northlight members, not to the internet.">
          <textarea
            id="p-story"
            className="textarea"
            value={form.story}
            onChange={(e) => setForm((f) => ({ ...f, story: e.target.value }))}
          />
        </Field>
        <Field label="Passions" htmlFor="p-passions" hint="Comma separated — cooking, chess, dogs.">
          <input
            id="p-passions"
            className="input"
            value={form.passions}
            onChange={(e) => setForm((f) => ({ ...f, passions: e.target.value }))}
          />
        </Field>
        <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
          <div className="grow">
            <Field label="High school" htmlFor="p-hs">
              <input
                id="p-hs"
                className="input"
                value={form.highSchool}
                onChange={(e) => setForm((f) => ({ ...f, highSchool: e.target.value }))}
                placeholder="Lincoln High"
              />
            </Field>
          </div>
          <div style={{ width: 110 }}>
            <Field label="Year" htmlFor="p-year">
              <input
                id="p-year"
                className="input"
                value={form.gradYear}
                onChange={(e) => setForm((f) => ({ ...f, gradYear: e.target.value }))}
                maxLength={4}
                inputMode="numeric"
              />
            </Field>
          </div>
        </div>
        <Field label="College or program" htmlFor="p-college">
          <input
            id="p-college"
            className="input"
            value={form.college}
            onChange={(e) => setForm((f) => ({ ...f, college: e.target.value }))}
            placeholder="City College — Culinary"
          />
        </Field>
      </Sheet>

      <Sheet
        open={storyOpen}
        onClose={() => setStoryOpen(false)}
        title="Post a story or a passion"
        footer={
          <>
            <Button variant="ghost" onClick={() => setStoryOpen(false)}>
              Cancel
            </Button>
            <Button full onClick={() => void publishPost()} disabled={busy}>
              {busy ? 'Posting…' : 'Post it'}
            </Button>
          </>
        }
      >
        <Segmented
          options={[
            { value: 'story', label: 'A story' },
            { value: 'passion', label: 'A passion' },
          ]}
          value={post.kind}
          onChange={(kind) => setPost((p) => ({ ...p, kind }))}
        />
        <Field label="Title" htmlFor="post-title">
          <input
            id="post-title"
            className="input"
            value={post.title}
            onChange={(e) => setPost((p) => ({ ...p, title: e.target.value }))}
            placeholder="The kitchen I want back"
          />
        </Field>
        <Field label="Write it" htmlFor="post-body">
          <textarea
            id="post-body"
            className="textarea"
            value={post.body}
            onChange={(e) => setPost((p) => ({ ...p, body: e.target.value }))}
            placeholder="Say it the way you would say it out loud."
            style={{ minHeight: 150 }}
          />
        </Field>
        <Field label="Tags" htmlFor="post-tags" hint="Comma separated — work, cooking, hope.">
          <input
            id="post-tags"
            className="input"
            value={post.tags}
            onChange={(e) => setPost((p) => ({ ...p, tags: e.target.value }))}
          />
        </Field>
        <p className="tiny muted">Posts are visible to Northlight members only. No location is ever attached.</p>
      </Sheet>
    </div>
  );
}
