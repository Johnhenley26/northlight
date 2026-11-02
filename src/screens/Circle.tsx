import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { api, Item, Msg, Person, Spot } from '../api';
import { clockTime, timeAgo, useApp } from '../store';
import { Avatar, Button, Card, CardHead, Empty, Field, Icon, Pill, Segmented, Sheet } from '../ui';

type Detail = { person: Person; spot: Spot; messages: Msg[]; wishes: Item[] };

const QUICK_REPLIES = [
  "I'm safe tonight.",
  'I got food. Thank you.',
  'I could use a ride.',
  'I am at the day center.',
  'Can we talk on the phone?',
];

function PersonRow({
  person,
  onClick,
  action,
  note,
}: {
  person: Person;
  onClick?: () => void;
  action?: ReactNode;
  note?: string;
}) {
  const sub =
    note ??
    (person.schoolMatch
      ? `Classmate · ${person.schoolMatch === 'college' ? person.college : person.highSchool}`
      : person.bio || `@${person.handle}`);
  return (
    <div className="person-row" style={{ cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}>
      <Avatar
        name={person.name}
        color={person.avatarColor}
        size={46}
        status={person.unread ? 'unread' : person.spot?.shared ? 'on' : undefined}
      />
      <div className="grow">
        <div className="row" style={{ gap: 8 }}>
          <span className="person-name truncate">{person.name}</span>
          {person.relationshipLabel === 'family' ? <Pill tone="amber">family</Pill> : null}
          {person.schoolMatch ? <Pill tone="mint">{person.schoolMatch}</Pill> : null}
        </div>
        <div className="person-sub truncate">{sub}</div>
      </div>
      {typeof person.unread === 'number' && person.unread > 0 ? (
        <span className="unread-count">{person.unread}</span>
      ) : null}
      {action}
    </div>
  );
}

export default function CircleScreen() {
  const { data, run, refresh, toast } = useApp();
  const [tab, setTab] = useState<'circle' | 'find' | 'requests'>('circle');
  const [detail, setDetail] = useState<Detail | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [people, setPeople] = useState<Person[] | null>(null);
  const [q, setQ] = useState('');
  const [school, setSchool] = useState<string | null>(null);
  const [mode, setMode] = useState<'classmates' | 'all'>('classmates');
  const [searching, setSearching] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const threadRef = useRef<HTMLDivElement | null>(null);

  const me = data?.me;
  const requests = data?.incoming.length ?? 0;

  async function openPerson(id: string) {
    try {
      const next = await api<Detail>(`/circle/${id}`);
      setDetail(next);
      void refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not open that conversation.', 'error');
    }
  }

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [detail]);

  useEffect(() => {
    if (tab === 'find' && people === null) void search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function search(next?: { q?: string; school?: string | null; mode?: 'classmates' | 'all' }) {
    const query = next?.q ?? q;
    const sch = next && 'school' in next ? next.school : school;
    const md = next?.mode ?? mode;
    setSearching(true);
    try {
      const res = await api<{ people: Person[] }>(
        `/people?q=${encodeURIComponent(query)}&school=${encodeURIComponent(sch ?? '')}&mode=${md}`
      );
      setPeople(res.people);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Search failed.', 'error');
    } finally {
      setSearching(false);
    }
  }

  async function addPerson(p: Person) {
    try {
      await api('/circle/request', {
        method: 'POST',
        body: { userId: p.id, relationship: p.schoolMatch ? 'classmate' : 'friend' },
      });
      setPeople((list) => list?.map((x) => (x.id === p.id ? { ...x, pending: 'outgoing' } : x)) ?? null);
      toast(`Request sent to ${p.name.split(' ')[0]}.`, 'ok');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not send that request.', 'error');
    }
  }

  async function send(text: string) {
    if (!detail) return;
    const body = text.trim();
    if (!body) return;
    setDraft('');
    setSending(true);
    try {
      await api('/messages', { method: 'POST', body: { to: detail.person.id, body } });
      const next = await api<Detail>(`/circle/${detail.person.id}`);
      setDetail(next);
      void refresh();
    } catch (err) {
      setDraft(body);
      toast(err instanceof Error ? err.message : 'Message not sent.', 'error');
    } finally {
      setSending(false);
    }
  }

  if (!data || !me) return null;

  /* --------------------------- conversation view --------------------------- */
  if (detail) {
    const p = detail.person;
    return (
      <div className="screen">
        <div className="back-row">
          <Button variant="quiet" size="sm" icon="back" onClick={() => setDetail(null)}>
            Circle
          </Button>
        </div>

        <Card>
          <div className="row" style={{ gap: 14 }}>
            <Avatar name={p.name} color={p.avatarColor} size={58} />
            <div className="grow">
              <h1 className="display" style={{ fontSize: '1.4rem', lineHeight: 1.2 }}>
                {p.name}
              </h1>
              <div className="tiny muted">@{p.handle}</div>
              <div className="row wrap" style={{ marginTop: 7 }}>
                <Pill tone={p.relationship === 'family' ? 'amber' : 'neutral'}>
                  {p.relationship === 'family' ? 'family' : p.relationship ?? 'friend'}
                </Pill>
                {p.highSchool ? <Pill>{p.highSchool}</Pill> : null}
              </div>
            </div>
          </div>

          <div className="note-box" style={{ marginTop: 14 }}>
            {detail.spot.shared ? (
              <>
                <b>Sharing their spot:</b> {detail.spot.label} · updated {timeAgo(detail.spot.at)}
                {detail.spot.lat && detail.spot.lng ? (
                  <>
                    {' · '}
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${detail.spot.lat}&mlon=${detail.spot.lng}#map=17/${detail.spot.lat}/${detail.spot.lng}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      open map
                    </a>
                  </>
                ) : null}
              </>
            ) : detail.spot.lastKnown ? (
              <>
                <b>Sharing is off.</b> Last known: {detail.spot.lastKnown.label} ·{' '}
                {timeAgo(detail.spot.lastKnown.at)}
              </>
            ) : (
              <>
                <b>Sharing is off.</b> They will still get your messages.
              </>
            )}
          </div>

          {p.bio ? (
            <p className="small" style={{ marginTop: 12, lineHeight: 1.55, color: '#cbd9df' }}>
              {p.bio}
            </p>
          ) : null}

          {p.socials && (p.socials.facebook || p.socials.instagram || p.socials.messenger) ? (
            <div className="row wrap" style={{ marginTop: 8, gap: 6 }}>
              {p.socials.facebook ? (
                <a
                  className="pill"
                  href={`https://facebook.com/${encodeURIComponent(p.socials.facebook)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Facebook
                </a>
              ) : null}
              {p.socials.messenger ? (
                <a
                  className="pill"
                  href={`https://m.me/${encodeURIComponent(p.socials.messenger)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Messenger
                </a>
              ) : null}
              {p.socials.instagram ? (
                <a
                  className="pill"
                  href={`https://instagram.com/${encodeURIComponent(p.socials.instagram)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Instagram
                </a>
              ) : null}
            </div>
          ) : null}
        </Card>

        <Card>
          <CardHead title={`Messages with ${p.name.split(' ')[0]}`} hint="Only the two of you can read this." icon="message" />
          <div className="thread" ref={threadRef}>
            {detail.messages.length === 0 ? (
              <p className="small muted">No messages yet. Say hello — a short one is fine.</p>
            ) : (
              detail.messages.map((m) => (
                <div key={m.id} className={`bubble ${m.fromMe ? 'bubble-me' : ''}`}>
                  {m.body}
                  <div className="bubble-time">{clockTime(m.at)}</div>
                </div>
              ))
            )}
          </div>

          <div className="quick-replies" style={{ marginTop: 12 }}>
            {QUICK_REPLIES.map((r) => (
              <button key={r} className="chip" onClick={() => void send(r)} disabled={sending}>
                {r}
              </button>
            ))}
          </div>

          <form
            className="composer"
            style={{ marginTop: 10 }}
            onSubmit={(e) => {
              e.preventDefault();
              void send(draft);
            }}
          >
            <textarea
              className="textarea grow"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`Message ${p.name.split(' ')[0]}…`}
              aria-label="Message"
              rows={1}
            />
            <Button type="submit" icon="send" disabled={sending || !draft.trim()} />
          </form>
        </Card>

        {detail.wishes.length > 0 ? (
          <Card>
            <CardHead title={`${p.name.split(' ')[0]}'s list`} hint="Things they have said they need or want." icon="heart" />
            <div className="stack-tight">
              {detail.wishes.map((w) => (
                <div key={w.id} className="list-item" style={{ alignItems: 'center' }}>
                  <div className="grow">
                    <div className="list-title">{w.title}</div>
                    <div className="list-note">
                      {w.kind} {w.note ? `· ${w.note}` : ''}
                    </div>
                  </div>
                  {w.claimedBy ? (
                    <Pill tone="mint">offered</Pill>
                  ) : (
                    <Button
                      size="sm"
                      variant="mint"
                      onClick={() =>
                        void run(
                          () => api(`/items/${w.id}/claim`, { method: 'POST' }),
                          `Offer sent to ${p.name.split(' ')[0]}.`
                        )
                      }
                    >
                      I can help
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        <div className="row wrap" style={{ gap: 8 }}>
          <Button
            variant="mint"
            size="sm"
            icon="heart"
            onClick={() =>
              void run(
                () => api('/love', { method: 'POST', body: { userId: p.id } }),
                `Love sent to ${p.name.split(' ')[0]}.`
              )
            }
          >
            Send love
          </Button>
          <Button
            variant="quiet"
            size="sm"
            icon="shield"
            onClick={async () => {
              if (!confirm(`Block ${p.name}? They will not be able to message you or see your posts.`)) return;
              const ok = await run(
                () => api('/blocks', { method: 'POST', body: { userId: p.id } }),
                `${p.name.split(' ')[0]} is blocked.`
              );
              if (ok) setDetail(null);
            }}
          >
            Block
          </Button>
          <Button
            variant="danger"
            size="sm"
            icon="trash"
            onClick={async () => {
              if (!confirm(`Remove ${p.name} from your circle? They will no longer see your spot.`)) return;
              const ok = await run(
                () => api(`/circle/${p.id}`, { method: 'DELETE' }),
                `${p.name.split(' ')[0]} removed from your circle.`
              );
              if (ok) setDetail(null);
            }}
          >
            Remove from circle
          </Button>
        </div>
      </div>
    );
  }

  /* ------------------------------ people search ---------------------------- */
  const filterQuery = (e: FormEvent) => {
    e.preventDefault();
    void search();
  };

  const addAction = (p: Person) =>
    p.relationship ? (
      <Pill tone="mint">in circle</Pill>
    ) : p.pending === 'outgoing' ? (
      <Pill>requested</Pill>
    ) : p.pending === 'incoming' ? (
      <Button
        size="sm"
        variant="primary"
        onClick={() => {
          const req = data.incoming.find((i) => i.id === p.id);
          if (req?.requestId)
            void run(
              () => api('/circle/respond', { method: 'POST', body: { requestId: req.requestId, accept: true } }),
              `${p.name.split(' ')[0]} is in your circle.`
            );
        }}
      >
        Accept
      </Button>
    ) : (
      <Button size="sm" variant="ghost" icon="plus" onClick={() => void addPerson(p)}>
        Add
      </Button>
    );

  return (
    <div className="screen">
      <div className="section-head">
        <div>
          <h1 className="section-title">Your circle</h1>
          <p className="section-sub">
            Family, friends, and the people you lost touch with. Nobody is added without you saying yes, and
            nobody outside this circle sees your spot.
          </p>
        </div>
      </div>

      <Segmented
        options={[
          { value: 'circle', label: 'Circle', badge: data.circle.length },
          { value: 'find', label: 'Find people' },
          { value: 'requests', label: 'Requests', badge: requests },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'circle' ? (
        <div className="wide-grid">
          <Card>
            <CardHead
              title="People in your circle"
              hint="Tap a person to message them or see their spot."
              icon="users"
              action={
                <Button size="sm" variant="ghost" icon="plus" onClick={() => setTab('find')}>
                  Add
                </Button>
              }
            />
            <div className="stack-tight">
              {data.circle.length === 0 ? (
                <Empty
                  icon="users"
                  title="Your circle is empty"
                  body="Search for family by name, or find people from your high school or college."
                  action={
                    <Button size="sm" onClick={() => setTab('find')}>
                      Find people
                    </Button>
                  }
                />
              ) : (
                data.circle.map((p) => (
                  <PersonRow
                    key={p.id}
                    person={p}
                    onClick={() => void openPerson(p.id)}
                    note={
                      p.lastMessage
                        ? `${p.lastMessage.fromMe ? 'You: ' : ''}${p.lastMessage.body}`
                        : 'No messages yet — say hello'
                    }
                  />
                ))
              )}
            </div>
          </Card>

          <div className="stack">
            <Card>
              <CardHead title="Your invite code" hint="Give this to family or a friend so they can join your circle." icon="send" />
              <div className="row-between">
                <code
                  style={{
                    fontFamily: 'ui-monospace, monospace',
                    fontSize: '1.15rem',
                    letterSpacing: '0.08em',
                    color: 'var(--amber-soft)',
                  }}
                >
                  {me.inviteCode}
                </code>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(me.inviteCode);
                      toast('Code copied.', 'ok');
                    } catch {
                      toast(`Your code is ${me.inviteCode}`, 'info');
                    }
                  }}
                >
                  Copy
                </Button>
              </div>
              <div className="divider" style={{ marginTop: 16 }}>
                or join someone
              </div>
              <form
                className="row"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const ok = await run(
                    () => api('/circle/join', { method: 'POST', body: { code: joinCode } }),
                    'You are in their circle now.'
                  );
                  if (ok) setJoinCode('');
                }}
              >
                <input
                  className="input grow"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="ANA-4F2C"
                  aria-label="Invite code"
                />
                <Button type="submit" variant="ghost" disabled={!joinCode.trim()}>
                  Join
                </Button>
              </form>
            </Card>

            <Card>
              <CardHead title="Meet in person" hint="Coordinates come from the person, not from you." icon="pin" />
              <p className="small muted" style={{ lineHeight: 1.55 }}>
                When someone in your circle shares a spot, you can open it in a map and walk over. If their
                location is off, the app will show you when and where they were last seen — never a live
                feed.
              </p>
            </Card>
          </div>
        </div>
      ) : null}

      {tab === 'find' ? (
        <div className="wide-grid">
          <Card>
            <CardHead
              title="Find people"
              hint="Search by name, handle, school, or something they love."
              icon="compass"
            />
            <form className="row" onSubmit={filterQuery}>
              <input
                className="input grow"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Devon, Lincoln High, cooking…"
                aria-label="Search people"
              />
              <Button type="submit" icon="compass" disabled={searching}>
                {searching ? '…' : 'Search'}
              </Button>
            </form>

            <div className="row wrap" style={{ marginTop: 12 }}>
              <button
                className={`chip ${mode === 'classmates' ? 'is-active' : ''}`}
                onClick={() => {
                  setMode('classmates');
                  void search({ mode: 'classmates', school: null });
                }}
              >
                My classmates
              </button>
              {me.highSchool ? (
                <button
                  className={`chip ${school === me.highSchool ? 'is-active' : ''}`}
                  onClick={() => {
                    setMode('all');
                    setSchool(me.highSchool);
                    void search({ mode: 'all', school: me.highSchool });
                  }}
                >
                  {me.highSchool}
                </button>
              ) : null}
              {me.college ? (
                <button
                  className={`chip ${school === me.college ? 'is-active' : ''}`}
                  onClick={() => {
                    setMode('all');
                    setSchool(me.college);
                    void search({ mode: 'all', school: me.college });
                  }}
                >
                  {me.college}
                </button>
              ) : null}
              <button
                className={`chip ${mode === 'all' && !school ? 'is-active' : ''}`}
                onClick={() => {
                  setMode('all');
                  setSchool(null);
                  void search({ mode: 'all', school: null });
                }}
              >
                Everyone
              </button>
            </div>

            <div className="stack-tight" style={{ marginTop: 16 }}>
              {people === null ? (
                <p className="small muted">Searching…</p>
              ) : people.length === 0 ? (
                <Empty
                  icon="users"
                  title="No one found"
                  body={
                    mode === 'classmates'
                      ? 'Add your high school or college in your profile, then try again — or search everyone.'
                      : 'Try a shorter search, or send them your invite code.'
                  }
                />
              ) : (
                people.map((p) => (
                  <PersonRow key={p.id} person={p} action={addAction(p)} onClick={() => void openPerson(p.id)} />
                ))
              )}
            </div>
          </Card>

          <div className="stack">
            <Card>
              <CardHead title="Your details" hint="These are what classmates search." icon="user" />
              <div className="stack-tight">
                <div className="row-between">
                  <span className="small muted">High school</span>
                  <span className="small strong">{me.highSchool || '—'}</span>
                </div>
                <div className="row-between">
                  <span className="small muted">College</span>
                  <span className="small strong">{me.college || '—'}</span>
                </div>
                <div className="row-between">
                  <span className="small muted">Graduated</span>
                  <span className="small strong">{me.gradYear || '—'}</span>
                </div>
              </div>
              <p className="field-hint" style={{ marginTop: 12 }}>
                Only your name, handle and schools are searchable. Your location never is.
              </p>
            </Card>
          </div>
        </div>
      ) : null}

      {tab === 'requests' ? (
        <div className="wide-grid">
          <Card>
            <CardHead title="Waiting on you" hint="Accepting adds them to your circle." icon="bell" />
            <div className="stack-tight">
              {data.incoming.length === 0 ? (
                <p className="small muted">No open requests.</p>
              ) : (
                data.incoming.map((p) => (
                  <PersonRow
                    key={p.id}
                    person={p}
                    note={`${p.name} wants to be in your circle · ${p.relationship ?? 'friend'}`}
                    action={
                      <div className="row" style={{ gap: 6 }}>
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() =>
                            void run(
                              () =>
                                api('/circle/respond', {
                                  method: 'POST',
                                  body: { requestId: (p as any).requestId, accept: true },
                                }),
                              `${p.name.split(' ')[0]} is in your circle.`
                            )
                          }
                        >
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="quiet"
                          onClick={() =>
                            void run(
                              () =>
                                api('/circle/respond', {
                                  method: 'POST',
                                  body: { requestId: (p as any).requestId, accept: false },
                                }),
                              'Request declined.'
                            )
                          }
                        >
                          Not now
                        </Button>
                      </div>
                    }
                  />
                ))
              )}
            </div>
          </Card>

          <Card>
            <CardHead title="You asked" icon="send" />
            {data.outgoing.length === 0 ? (
              <p className="small muted">No requests sent.</p>
            ) : (
              <div className="stack-tight">
                {data.outgoing.map((p) => (
                  <PersonRow key={p.id} person={p} note="Waiting for them to accept" action={<Pill>pending</Pill>} />
                ))}
              </div>
            )}
          </Card>
        </div>
      ) : null}
    </div>
  );
}
