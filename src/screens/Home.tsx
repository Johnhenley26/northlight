import { useState } from 'react';
import { api, Resource } from '../api';
import { greeting, mapsUrl, timeAgo, todayLabel, useApp } from '../store';
import { Button, Card, CardHead, Icon, Pill, Progress, Segmented } from '../ui';
import { Go } from '../nav';
import { DeliverySheet } from './Help';
import PostCard from '../PostCard';

const STAGES = ['received', 'preparing', 'on the way', 'delivered'];
const STAGE_LABELS: Record<string, string> = {
  received: 'Received',
  preparing: 'Packed',
  'on the way': 'On the way',
  delivered: 'Arrived',
};

export default function HomeScreen({ go }: { go: Go }) {
  const { data, run, toast } = useApp();
  const [mealFor, setMealFor] = useState<Resource | null>(null);

  if (!data) return null;
  const { me, circle, items, deliveries, posts, wishlistForMe, incoming } = data;
  const resources = data.resources ?? [];
  const first = me.name.split(' ')[0] || me.name;
  const sharing = !!me.shareLocation && !!me.location;
  const spotLabel = me.location?.label || me.lastKnown?.label || 'No spot saved yet';
  const active = deliveries.find((d) => d.stage !== 'delivered');
  const needs = items.filter((i) => i.kind === 'need' && !i.done);
  const goals = items.filter((i) => i.kind === 'goal' && !i.done);
  const wishes = items.filter((i) => i.kind === 'wish');
  const todaysMeals = resources.filter((r) => r.type === 'food' && r.openToday).slice(0, 3);

  function toggleSharing() {
    if (!me.location) {
      toast('Add a spot first — then you can switch sharing on.', 'info');
      go('spot');
      return;
    }
    void run(
      () => api('/location/settings', { method: 'PATCH', body: { shareLocation: !me.shareLocation } }),
      me.shareLocation
        ? 'Sharing is off. Your last spot is saved, just for you.'
        : 'Your spot is live — only the people in your circle can see it.'
    );
  }

  return (
    <div className="screen">
      <header className="home-hero">
        <p className="eyebrow">{todayLabel()}</p>
        <h1 className="display home-title">
          {greeting()}, {first}.
        </h1>
        <p className="home-sub">
          {sharing
            ? `${circle.length || 'No'} ${circle.length === 1 ? 'person' : 'people'} in your circle can see ${
                me.location?.precision === 'area' ? 'roughly where you are' : 'exactly where you are'
              }.`
            : `Your spot is private right now. ${
                me.lastKnown ? `Last known: ${me.lastKnown.label}.` : 'Set one whenever you are ready.'
              }`}
        </p>
        <div className="row wrap">
          {sharing ? (
            <Pill tone="mint" icon="shield">
              Location shared with your circle
            </Pill>
          ) : (
            <Pill icon="lock">Location private</Pill>
          )}
          {data.unread > 0 ? (
            <Pill tone="amber" icon="message">
              {data.unread} new message{data.unread === 1 ? '' : 's'}
            </Pill>
          ) : null}
        </div>
      </header>

      <div className="wide-grid">
        <div className="stack">
          <Card>
            <div className="beacon-wrap">
              <button
                className={`beacon ${me.shareLocation ? 'is-on' : 'is-off'}`}
                onClick={toggleSharing}
                aria-pressed={me.shareLocation}
                aria-label={me.shareLocation ? 'Stop sharing my spot' : 'Start sharing my spot'}
              >
                <span className="beacon-dot" />
                <Icon name="pin" size={22} />
                <span>{me.shareLocation ? 'Sharing' : 'Private'}</span>
              </button>
              <div className="spot-copy grow">
                <span className="eyebrow">{me.shareLocation ? 'Live to your circle' : 'Only you can see this'}</span>
                <h2 className="spot-label">{spotLabel}</h2>
                <span className="spot-line">
                  <Icon name="clock" size={14} />
                  {me.location ? `updated ${timeAgo(me.location.at)}` : 'no spot shared yet'}
                  {me.lastKnown && !me.location ? ` · last known ${timeAgo(me.lastKnown.at)}` : ''}
                </span>
                <div className="row wrap" style={{ marginTop: 8 }}>
                  <Button size="sm" variant="ghost" icon="pin" onClick={() => go('spot')}>
                    Update my spot
                  </Button>
                  <Button size="sm" variant="quiet" icon="users" onClick={() => go('circle')}>
                    Who can see it
                  </Button>
                </div>
              </div>
            </div>

            {me.shareLocation ? (
              <div style={{ marginTop: 16 }}>
                <Segmented
                  small
                  options={[
                    { value: 'area', label: 'Just my area' },
                    { value: 'exact', label: 'Exact spot' },
                  ]}
                  value={(me.location?.precision ?? 'area') as 'area' | 'exact'}
                  onChange={(precision) =>
                    void run(() =>
                      api('/location/settings', { method: 'PATCH', body: { precision } })
                    )
                  }
                />
                <p className="field-hint" style={{ marginTop: 8 }}>
                  “Just my area” rounds your spot to about a five-minute walk. The switch above turns sharing
                  off completely.
                </p>
              </div>
            ) : (
              <p className="field-hint" style={{ marginTop: 14 }}>
                Your last known spot is recorded every time you check in, even while sharing is off. Only you
                can see it.
              </p>
            )}
          </Card>

          {active ? (
            <Card>
              <CardHead
                title="Food is on the way"
                hint={`${active.meal} · ${active.resourceName}`}
                icon="food"
                action={<Pill tone="amber">{active.minutesLeft > 0 ? `${active.minutesLeft} min` : 'arriving'}</Pill>}
              />
              <Progress value={active.progress} />
              <div className="tracker-stages">
                {STAGES.map((s, i) => (
                  <div key={s} className={`stage ${STAGES.indexOf(active.stage) >= i ? 'is-done' : ''}`}>
                    <span className="stage-bar" />
                    {STAGE_LABELS[s]}
                  </div>
                ))}
              </div>
              <p className="tiny muted" style={{ marginTop: 12 }}>
                {active.courier} · bringing {active.servings > 1 ? `${active.servings} meals` : 'it'} to{' '}
                {active.locationLabel}
              </p>
              <div style={{ marginTop: 10 }}>
                <Button size="sm" variant="ghost" icon="compass" onClick={() => go('help', { help: 'deliveries' })}>
                  Track delivery
                </Button>
              </div>
            </Card>
          ) : null}

          <Card>
            <CardHead
              title="Hot food today"
              hint="Partner kitchens. Delivery takes about 40 minutes, no cost to you."
              icon="food"
              action={
                <Button size="sm" variant="quiet" onClick={() => go('help', { help: 'food' })}>
                  All resources
                </Button>
              }
            />
            <div className="res-list">
              {todaysMeals.length === 0 ? (
                <p className="small muted">No kitchen is open today. Water and shelter are still listed under Help.</p>
              ) : (
                todaysMeals.map((r) => (
                  <div key={r.id} className="res" style={{ padding: 13 }}>
                    <div className="res-head">
                      <div>
                        <div className="res-name">{r.name}</div>
                        <div className="res-org">
                          {r.hours} · {r.address}
                        </div>
                      </div>
                      <Pill tone="mint" icon="clock">
                        Open today
                      </Pill>
                    </div>
                    <div className="res-actions">
                      <Button size="sm" variant="primary" icon="food" onClick={() => setMealFor(r)}>
                        Deliver to me
                      </Button>
                      <a
                        className="btn btn-ghost btn-sm"
                        href={mapsUrl(r.lat, r.lng, r.name)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Icon name="map" size={15} />
                        <span>Directions</span>
                      </a>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card>
            <CardHead
              title="Stories & passions"
              hint="What people are carrying — and what they can do."
              icon="spark"
              action={
                <Button size="sm" variant="quiet" onClick={() => go('me')}>
                  Your story
                </Button>
              }
            />
            {posts.length === 0 ? (
              <p className="small muted">No stories yet. Yours can be first.</p>
            ) : (
              posts.slice(0, 2).map((p) => <PostCard key={p.id} post={p} compact />)
            )}
          </Card>
        </div>

        <div className="stack">
          <Card>
            <CardHead title="Quick moves" icon="compass" />
            <div className="quick-grid">
              <button className="quick-btn" onClick={() => go('help', { help: 'food' })}>
                <span className="quick-icon">
                  <Icon name="water" size={20} />
                </span>
                <span className="quick-label">Food & water</span>
                <span className="quick-note">Meals, taps, showers</span>
              </button>
              <button className="quick-btn" onClick={() => go('circle')}>
                <span className="quick-icon">
                  <Icon name="message" size={20} />
                </span>
                <span className="quick-label">Message my circle</span>
                <span className="quick-note">
                  {data.unread > 0 ? `${data.unread} waiting` : 'Family & friends'}
                </span>
              </button>
              <button className="quick-btn" onClick={() => go('help', { help: 'residency' })}>
                <span className="quick-icon">
                  <Icon name="bed" size={20} />
                </span>
                <span className="quick-label">A room of my own</span>
                <span className="quick-note">Free & paid residency</span>
              </button>
              <button className="quick-btn" onClick={() => go('me')}>
                <span className="quick-icon">
                  <Icon name="spark" size={20} />
                </span>
                <span className="quick-label">Needs & wishes</span>
                <span className="quick-note">Goals, dreams, list</span>
              </button>
              <button className="quick-btn" onClick={() => go('news')}>
                <span className="quick-icon">
                  <Icon name="news" size={20} />
                </span>
                <span className="quick-label">News</span>
                <span className="quick-note">World, US, your state</span>
              </button>
              <button className="quick-btn" onClick={() => go('games')}>
                <span className="quick-icon">
                  <Icon name="game" size={20} />
                </span>
                <span className="quick-label">Games</span>
                <span className="quick-note">Solo or with a friend</span>
              </button>
              <button className="quick-btn" onClick={() => go('success')}>
                <span className="quick-icon">
                  <Icon name="trophy" size={20} />
                </span>
                <span className="quick-label">Success stories</span>
                <span className="quick-note">People who got out</span>
              </button>
            </div>
          </Card>

          <Card>
            <CardHead
              title="Your circle"
              hint="Only these people can see your spot."
              icon="users"
              action={
                <Button size="sm" variant="quiet" onClick={() => go('circle')}>
                  Open
                </Button>
              }
            />
            <div className="circle-strip">
              {circle.map((p) => (
                <button key={p.id} className="circle-item" onClick={() => go('circle')}>
                  <span style={{ position: 'relative' }}>
                    <span
                      className={`avatar ${p.unread ? 'avatar-ring' : ''}`}
                      style={{ width: 52, height: 52, background: p.avatarColor, fontSize: 20 }}
                    >
                      {(p.name || '?')
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((x) => x[0])
                        .join('')}
                      <span className={`avatar-dot avatar-dot-${p.unread ? 'unread' : p.spot.shared ? 'on' : 'off'}`} />
                    </span>
                  </span>
                  <span className="name">{p.name.split(' ')[0]}</span>
                </button>
              ))}
              <button className="circle-item" onClick={() => go('circle')}>
                <span
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: '50%',
                    border: '1px dashed var(--line-strong)',
                    display: 'grid',
                    placeItems: 'center',
                    color: 'var(--muted)',
                  }}
                >
                  <Icon name="plus" size={20} />
                </span>
                <span className="name">Find</span>
              </button>
            </div>
            {incoming.length > 0 ? (
              <div className="note-box" style={{ marginTop: 12 }}>
                <b>
                  {incoming.length} request{incoming.length === 1 ? '' : 's'}
                </b>{' '}
                waiting for you. <a href="#" onClick={(e) => { e.preventDefault(); go('circle'); }}>Review</a>
              </div>
            ) : null}
          </Card>

          <Card>
            <CardHead
              title="Needs, goals & wishes"
              icon="spark"
              action={
                <Button size="sm" variant="quiet" onClick={() => go('me')}>
                  Edit
                </Button>
              }
            />
            <div className="stat-row">
              <div className="stat">
                <b>{needs.length}</b>
                <span>Needs open</span>
              </div>
              <div className="stat">
                <b>{goals.length}</b>
                <span>Goals moving</span>
              </div>
              <div className="stat">
                <b>{wishes.length}</b>
                <span>Wishes</span>
              </div>
            </div>
            {goals.slice(0, 2).map((g) => (
              <div key={g.id} style={{ marginTop: 14 }}>
                <div className="row-between">
                  <span className="small strong">{g.title}</span>
                  <span className="tiny muted">{g.progress}%</span>
                </div>
                <div style={{ marginTop: 6 }}>
                  <Progress value={g.progress} tone="mint" />
                </div>
              </div>
            ))}
          </Card>

          {wishlistForMe.length > 0 ? (
            <Card>
              <CardHead title="Wishes you could fill" hint="Small things that change a week." icon="heart" />
              <div className="stack-tight">
                {wishlistForMe.slice(0, 3).map((w) => (
                  <div key={w.id} className="list-item" style={{ alignItems: 'center' }}>
                    <div className="grow">
                      <div className="list-title">{w.title}</div>
                      <div className="list-note">
                        {w.owner} · {w.kind}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="mint"
                      onClick={() =>
                        void run(
                          () => api(`/items/${w.id}/claim`, { method: 'POST' }),
                          'Offer sent. You are in their circle now, so you can arrange it.'
                        )
                      }
                    >
                      I can help
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
        </div>
      </div>

      <DeliverySheet resource={mealFor} resources={resources} onClose={() => setMealFor(null)} />
    </div>
  );
}
