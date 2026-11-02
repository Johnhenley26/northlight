import { api, Notif } from '../api';
import { timeAgo, useApp } from '../store';
import { Avatar, Button, Card, CardHead, Empty, Icon, IconName, Pill } from '../ui';

const ICON: Record<Notif['type'], IconName> = {
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

export default function NotificationsScreen() {
  const { data, run } = useApp();
  if (!data) return null;
  const rows = data.notifications;

  return (
    <div className="screen">
      <div className="section-head">
        <div>
          <h1 className="section-title">Notifications</h1>
          <p className="section-sub">Love, comments, requests, game results, and safety alerts.</p>
        </div>
        <Button
          size="sm"
          variant="quiet"
          icon="check"
          disabled={data.unreadNotifications === 0}
          onClick={() => void run(() => api('/notifications/read', { method: 'POST' }), 'All caught up.')}
        >
          Mark all read
        </Button>
      </div>

      {data.sos.length > 0 ? (
        <Card>
          <CardHead title="Your SOS is still open" icon="siren" action={<Pill tone="rose">active</Pill>} />
          {data.sos.map((s) => (
            <div key={s.id} className="row-between" style={{ marginTop: 8 }}>
              <div>
                <div className="small strong">{s.kindLabel}</div>
                <div className="tiny muted">
                  {timeAgo(s.at)} · {s.locationLabel} · {s.circleNotified} told
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void run(() => api(`/sos/${s.id}/cancel`, { method: 'POST' }), 'Alert closed.')}
              >
                I am safe
              </Button>
            </div>
          ))}
        </Card>
      ) : null}

      <Card>
        {rows.length === 0 ? (
          <Empty
            icon="bell"
            title="Quiet for now"
            body="When someone sends love, comments on your post, or asks to join your circle, it lands here."
          />
        ) : (
          <div className="stack-tight">
            {rows.map((n) => (
              <div key={n.id} className={`notif-row ${n.read ? '' : 'is-unread'}`}>
                {n.from ? (
                  <Avatar name={n.from.name} color={n.from.avatarColor} size={36} />
                ) : (
                  <span className="notif-icon">
                    <Icon name={ICON[n.type]} size={16} />
                  </span>
                )}
                <div className="grow">
                  <div className="notif-text">{n.text}</div>
                  <div className="tiny muted" style={{ marginTop: 4 }}>
                    <Icon name={ICON[n.type]} size={12} /> {n.type} · {timeAgo(n.at)}
                  </div>
                </div>
                {!n.read ? <span className="unread-count">•</span> : null}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
