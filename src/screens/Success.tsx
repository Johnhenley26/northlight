import { useState } from 'react';
import { api, SuccessStory } from '../api';
import { timeAgo, useApp } from '../store';
import { Avatar, Button, Card, CardHead, Empty, Field, Icon, Pill, Sheet, Toggle } from '../ui';

export default function SuccessScreen() {
  const { data, run, toast, refresh } = useApp();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<SuccessStory | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [years, setYears] = useState('1');
  const [city, setCity] = useState('');
  const [anon, setAnon] = useState(false);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  if (!data) return null;
  const stories = data.successStories || [];
  const housed = data.me.housingStatus === 'housed' || data.me.housingStatus === 'residency';

  async function publish() {
    setBusy(true);
    try {
      await api('/success', {
        method: 'POST',
        body: { title, body, yearsOut: Number(years) || 0, city, anonymous: anon },
      });
      setOpen(false);
      setTitle('');
      setBody('');
      setCity('');
      await refresh();
      toast('Your story is up. It might be the one someone needed today.', 'ok');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not publish that.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen">
      <div className="section-head">
        <div>
          <h1 className="section-title">Success stories</h1>
          <p className="section-sub">
            People who got out, in their own words. Not inspiration for its own sake — routes, phone numbers,
            and what actually helped.
          </p>
        </div>
        <Button size="sm" icon="plus" onClick={() => setOpen(true)}>
          Share yours
        </Button>
      </div>

      {housed ? (
        <Card>
          <div className="row" style={{ gap: 10 }}>
            <span className="hub-icon">
              <Icon name="trophy" size={19} />
            </span>
            <div className="grow">
              <b>You marked yourself housed.</b>
              <p className="small muted" style={{ margin: '4px 0 0', lineHeight: 1.55 }}>
                Your page can stay exactly as it is, hide from search, or become a success story. All three are
                yours to choose — nothing changes without you.
              </p>
            </div>
          </div>
          <div className="row wrap" style={{ marginTop: 10 }}>
            <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
              Write the story
            </Button>
            <Pill tone="mint">housed {data.me.housedSince || 'recently'}</Pill>
          </div>
        </Card>
      ) : null}

      {stories.length === 0 ? (
        <Card>
          <Empty
            icon="trophy"
            title="No stories yet"
            body="If you made it out, your route could be the one someone else copies. If you are still out, read what worked."
            action={
              <Button size="sm" onClick={() => setOpen(true)}>
                Add the first story
              </Button>
            }
          />
        </Card>
      ) : (
        stories.map((s) => (
          <article key={s.id} className="story-card">
            <div className="row" style={{ gap: 10 }}>
              <Avatar name={s.author.name} color={s.author.avatarColor} size={40} />
              <div className="grow">
                <div className="small strong">{s.author.name}</div>
                <div className="tiny muted">
                  {s.author.housedSince ? `Housed since ${s.author.housedSince}` : `${s.yearsOut} year${s.yearsOut === 1 ? '' : 's'} out`}
                  {s.city ? ` · ${s.city}` : ''} · {timeAgo(s.at)}
                </div>
              </div>
              <Pill tone="mint" icon="trophy">
                {s.yearsOut > 0 ? `${s.yearsOut}y out` : 'out'}
              </Pill>
            </div>

            <h2>{s.title}</h2>
            <p className={s.body.length > 500 ? '' : ''}>{s.body.slice(0, 700)}{s.body.length > 700 ? '…' : ''}</p>

            <div className="row wrap" style={{ gap: 8 }}>
              <Button
                size="sm"
                variant={s.liked ? 'mint' : 'quiet'}
                icon="heart"
                onClick={() => void run(() => api(`/success/${s.id}/like`, { method: 'POST' }))}
              >
                {s.likesCount} moved
              </Button>
              <Button size="sm" variant="quiet" icon="comment" onClick={() => setDetail(s)}>
                {s.comments.length} comments
              </Button>
              {s.body.length > 700 ? (
                <Button size="sm" variant="ghost" onClick={() => setDetail(s)}>
                  Read it all
                </Button>
              ) : null}
            </div>
          </article>
        ))
      )}

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Share your story"
        footer={
          <Button
            full
            icon="check"
            disabled={busy || title.trim().length < 5 || body.trim().length < 60}
            onClick={() => void publish()}
          >
            {busy ? 'Publishing…' : 'Publish'}
          </Button>
        }
      >
        <Field label="Title" hint="“I got the keys at 61” works better than “My story”.">
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} />
        </Field>
        <Field label="What happened" hint="What actually helped, what did not, and what you would tell someone still out there.">
          <textarea className="textarea" rows={9} value={body} onChange={(e) => setBody(e.target.value)} maxLength={6000} />
        </Field>
        <div className="row" style={{ gap: 12 }}>
          <Field label="Years out">
            <input className="input" type="number" min={0} max={80} value={years} onChange={(e) => setYears(e.target.value)} style={{ width: 90 }} />
          </Field>
          <Field label="City (optional)">
            <input className="input" value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} />
          </Field>
        </div>
        <Toggle
          label="Post it anonymously"
          description="Your name and handle are hidden. The story still shows."
          checked={anon}
          onChange={setAnon}
        />
      </Sheet>

      <Sheet open={!!detail} onClose={() => setDetail(null)} title={detail?.title || 'Story'}>
        {detail ? (
          <div className="stack">
            <p className="small" style={{ lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{detail.body}</p>
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
                try {
                  await api(`/success/${detail.id}/comment`, { method: 'POST', body: { body: comment } });
                  setComment('');
                  const res = await api<{ stories: SuccessStory[] }>('/success');
                  const found = res.stories.find((s) => s.id === detail.id);
                  if (found) setDetail(found);
                  await refresh();
                } catch (err) {
                  toast(err instanceof Error ? err.message : 'Comment failed.', 'error');
                }
              }}
            >
              <input
                className="input grow"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Say something to them…"
              />
              <Button type="submit" icon="send" disabled={!comment.trim()} />
            </form>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
