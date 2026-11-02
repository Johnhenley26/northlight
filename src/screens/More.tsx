import { Notif } from '../api';
import { timeAgo, useApp } from '../store';
import { Card, CardHead, Icon, IconName, Pill } from '../ui';
import { Go, Tab } from '../nav';

const TILES: { tab: Tab; label: string; note: string; icon: IconName }[] = [
  { tab: 'news', label: 'News', note: 'World, national and every state, DC, PR and the Virgin Islands', icon: 'news' },
  { tab: 'photos', label: 'Photos & reels', note: 'Your pictures, short videos, captions and comments', icon: 'camera' },
  { tab: 'success', label: 'Success stories', note: 'People who got out — and how they did it', icon: 'trophy' },
  { tab: 'help', label: 'Help & food', note: 'Meals, water, beds, showers, residency', icon: 'life' },
  { tab: 'me', label: 'Your page', note: 'Story, passions, needs, wishes and lists', icon: 'user' },
  { tab: 'settings', label: 'Settings & privacy', note: 'Who sees what, blocks, linked accounts, your data', icon: 'settings' },
];

const NOTIF_ICON: Record<Notif['type'], IconName> = {
  love: 'heart',
  like: 'heart',
  comment: 'comment',
  share: 'share',
  request: 'users',
  accepted: 'check',
  sos: 'siren',
  game: 'game',
  housing: 'home',
  system: 'bell',
};

export default function MoreScreen({ go }: { go: Go }) {
  const { data } = useApp();
  if (!data) return null;
  const { notifications, unreadNotifications } = data;

  return (
    <div className="screen">
      <div className="section-head">
        <div>
          <h1 className="section-title">More</h1>
          <p className="section-sub">Everything else, one tap away. The SOS button stays on every screen.</p>
        </div>
      </div>

      <Card>
        <CardHead
          title="Notifications"
          hint={unreadNotifications > 0 ? `${unreadNotifications} new` : 'Nothing new right now'}
          icon="bell"
          action={
            <button className="btn btn-quiet btn-sm" onClick={() => go('notifications')}>
              <span>Open</span>
              {unreadNotifications > 0 ? <span className="nav-badge">{unreadNotifications}</span> : null}
            </button>
          }
        />
        {notifications.length === 0 ? (
          <p className="small muted">Love, comments, requests and game results will show up here.</p>
        ) : (
          <div className="stack-tight">
            {notifications.slice(0, 3).map((n) => (
              <div key={n.id} className={`notif-row ${n.read ? '' : 'is-unread'}`}>
                <span className="notif-icon">
                  <Icon name={NOTIF_ICON[n.type]} size={16} />
                </span>
                <div className="grow">
                  <div className="notif-text">{n.text}</div>
                  <div className="tiny muted" style={{ marginTop: 4 }}>
                    {timeAgo(n.at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="hub-grid">
        {TILES.map((t) => (
          <button key={t.tab} className="hub-tile" onClick={() => go(t.tab)}>
            <span className="hub-icon">
              <Icon name={t.icon} size={19} />
            </span>
            <b>{t.label}</b>
            <span>{t.note}</span>
          </button>
        ))}
        <button className="hub-tile" onClick={() => go('notifications')}>
          <span className="hub-icon">
            <Icon name="bell" size={19} />
          </span>
          <b>Notifications</b>
          <span>Love, comments, requests and results</span>
        </button>
      </div>

      <Card>
        <CardHead title="If you are in danger" icon="siren" />
        <p className="small" style={{ lineHeight: 1.6, color: '#cbd9df' }}>
          The red SOS button is on every screen. It tells the people in your circle where you last were and
          puts 911, 988 and the Never Use Alone line one tap away. Northlight does not dispatch emergency
          services itself.
        </p>
        <div className="row wrap" style={{ marginTop: 10 }}>
          <Pill tone="rose" icon="siren">SOS always visible</Pill>
          <Pill icon="shield">Only your circle is told</Pill>
        </div>
      </Card>
    </div>
  );
}
