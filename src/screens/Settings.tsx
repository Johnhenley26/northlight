import { useState } from 'react';
import { api, HousingStatus, NotifyPrefs } from '../api';
import { timeAgo, useApp } from '../store';
import { Avatar, Button, Card, CardHead, Field, Icon, Pill, Segmented, Toggle } from '../ui';
import { Go } from '../nav';

const HOUSING: { value: HousingStatus; label: string }[] = [
  { value: 'homeless', label: 'Outside' },
  { value: 'shelter', label: 'Shelter' },
  { value: 'residency', label: 'Residency' },
  { value: 'housed', label: 'Housed' },
];

export default function SettingsScreen({ go }: { go: Go }) {
  const { data, run, logout, toast, refresh } = useApp();
  const [socials, setSocials] = useState(() => ({
    facebook: data?.me.socials?.facebook || '',
    messenger: data?.me.socials?.messenger || '',
    instagram: data?.me.socials?.instagram || '',
  }));
  const [deleting, setDeleting] = useState('');

  if (!data) return null;
  const me = data.me;
  const prefs: NotifyPrefs = me.notifyPrefs || { love: true, comments: true, requests: true, games: true, news: false };

  function savePrefs(next: Partial<NotifyPrefs>) {
    void run(
      () => api('/me', { method: 'PATCH', body: { notifyPrefs: { ...prefs, ...next } } }),
      'Notification settings saved.'
    );
  }

  function setHousing(status: HousingStatus, hidePage = me.pageHidden) {
    void run(
      () => api('/housing', { method: 'POST', body: { status, hidePage } }),
      status === 'housed'
        ? 'Marked housed. Nothing else changed — your page is still yours.'
        : 'Housing status updated.'
    );
  }

  async function exportData() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `northlight-${me.handle}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Your data was downloaded to this device.', 'ok');
  }

  return (
    <div className="screen">
      <div className="section-head">
        <div>
          <h1 className="section-title">Settings & privacy</h1>
          <p className="section-sub">
            Every switch here changes what other people can see. Nothing is shared without you turning it on.
          </p>
        </div>
      </div>

      <Card>
        <CardHead
          title="Location"
          hint="Your spot is only ever visible to people in your circle."
          icon="pin"
          action={<Pill tone={me.shareLocation ? 'mint' : 'neutral'}>{me.shareLocation ? 'sharing' : 'private'}</Pill>}
        />
        <div className="settings-block">
          <Toggle
            label="Share my spot with my circle"
            description={me.shareLocation ? 'On — your circle can see where you checked in.' : 'Off — nobody sees a live spot.'}
            checked={me.shareLocation}
            onChange={(next) =>
              void run(
                () => api('/location/settings', { method: 'PATCH', body: { shareLocation: next } }),
                next ? 'Sharing is on.' : 'Sharing is off. Your last spot is still saved for you.'
              )
            }
          />
          <Toggle
            label="Let my circle see my last known spot"
            description="Used when your phone is off or you have not checked in. You can keep this off and still check in."
            checked={me.shareLastKnown}
            onChange={(next) =>
              void run(() => api('/location/settings', { method: 'PATCH', body: { shareLastKnown: next } }), 'Saved.')
            }
          />
          {me.location ? (
            <div>
              <div className="tiny muted" style={{ marginBottom: 6 }}>
                Detail level
              </div>
              <Segmented
                small
                options={[
                  { value: 'area', label: 'Area only' },
                  { value: 'exact', label: 'Exact spot' },
                ]}
                value={(me.location.precision || 'area') as 'area' | 'exact'}
                onChange={(precision) =>
                  void run(() => api('/location/settings', { method: 'PATCH', body: { precision } }), 'Saved.')
                }
              />
            </div>
          ) : null}
          <p className="tiny muted" style={{ lineHeight: 1.5 }}>
            Last recorded: {me.lastKnown ? `${me.lastKnown.label} · ${timeAgo(me.lastKnown.at)}` : 'nothing yet'}.
          </p>
        </div>
      </Card>

      <Card>
        <CardHead title="Who can reach me" hint="This controls new friend requests, not people already in your circle." icon="users" />
        <Segmented
          options={[
            { value: 'everyone', label: 'Anyone' },
            { value: 'classmates', label: 'Classmates' },
            { value: 'nobody', label: 'Nobody' },
          ]}
          value={me.requestPolicy}
          onChange={(requestPolicy) =>
            void run(() => api('/me', { method: 'PATCH', body: { requestPolicy } }), 'Request setting saved.')
          }
        />
        <p className="field-hint" style={{ marginTop: 10 }}>
          “Classmates” means people who share your high school or college.
        </p>
      </Card>

      <Card>
        <CardHead title="Housing status" hint="Only you see this until you choose to share it." icon="home" />
        <Segmented options={HOUSING} value={me.housingStatus} onChange={(status) => setHousing(status)} />
        <div className="settings-block" style={{ marginTop: 14 }}>
          <Toggle
            label="Hide my page from search"
            description="People outside your circle cannot find you or see your posts. You can turn this back on any time."
            checked={me.pageHidden}
            onChange={(next) => setHousing(me.housingStatus, next)}
          />
          {me.housingStatus === 'housed' ? (
            <div className="note-box">
              <b>You made it out.</b> Your story could be the one someone copies.{' '}
              <a href="#" onClick={(e) => { e.preventDefault(); go('success'); }}>
                Share it
              </a>{' '}
              — anonymously if you prefer.
            </div>
          ) : null}
        </div>
      </Card>

      <Card>
        <CardHead title="Notifications" hint="What lands in your bell." icon="bell" />
        <div className="settings-block">
          <Toggle label="Love from people" checked={prefs.love} onChange={(next) => savePrefs({ love: next })} />
          <Toggle label="Comments and likes" checked={prefs.comments} onChange={(next) => savePrefs({ comments: next })} />
          <Toggle label="Friend requests" checked={prefs.requests} onChange={(next) => savePrefs({ requests: next })} />
          <Toggle label="Game invitations and results" checked={prefs.games} onChange={(next) => savePrefs({ games: next })} />
          <Toggle label="News alerts" checked={prefs.news} onChange={(next) => savePrefs({ news: next })} />
        </div>
        <p className="field-hint" style={{ marginTop: 10 }}>
          Safety alerts always come through, even with everything else off.
        </p>
      </Card>

      <Card>
        <CardHead
          title="Linked accounts"
          hint="Northlight stores the handle you type. It never posts for you and never reads your feed."
          icon="share"
        />
        <div className="settings-block">
          <div className="social-row">
            <span>Facebook</span>
            <input
              className="input"
              value={socials.facebook}
              onChange={(e) => setSocials((s) => ({ ...s, facebook: e.target.value }))}
              placeholder="your.facebook.name"
            />
          </div>
          <div className="social-row">
            <span>Messenger</span>
            <input
              className="input"
              value={socials.messenger}
              onChange={(e) => setSocials((s) => ({ ...s, messenger: e.target.value }))}
              placeholder="messenger handle"
            />
          </div>
          <div className="social-row">
            <span>Instagram</span>
            <input
              className="input"
              value={socials.instagram}
              onChange={(e) => setSocials((s) => ({ ...s, instagram: e.target.value }))}
              placeholder="instagram handle"
            />
          </div>
          <div className="row wrap">
            <Button
              size="sm"
              icon="check"
              onClick={() =>
                void run(() => api('/me', { method: 'PATCH', body: { socials } }), 'Linked accounts saved.')
              }
            >
              Save links
            </Button>
            {me.socials?.facebook ? (
              <a className="btn btn-ghost btn-sm" href={`https://facebook.com/${encodeURIComponent(me.socials.facebook)}`} target="_blank" rel="noreferrer">
                <Icon name="share" size={15} />
                <span>Open Facebook</span>
              </a>
            ) : null}
            {me.socials?.instagram ? (
              <a className="btn btn-ghost btn-sm" href={`https://instagram.com/${encodeURIComponent(me.socials.instagram)}`} target="_blank" rel="noreferrer">
                <Icon name="camera" size={15} />
                <span>Open Instagram</span>
              </a>
            ) : null}
          </div>
          <p className="tiny muted" style={{ lineHeight: 1.5 }}>
            These are links, not a login. Northlight cannot log in to Facebook, Messenger or Instagram on your behalf.
          </p>
        </div>
      </Card>

      <Card>
        <CardHead title="Blocked" hint="Blocked people cannot message you, request you, or see your posts." icon="shield" />
        {data.blocks.length === 0 ? (
          <p className="small muted">You have not blocked anyone.</p>
        ) : (
          <div className="stack-tight">
            {data.blocks.map((b) => (
              <div key={b.id} className="row" style={{ gap: 10, alignItems: 'center' }}>
                <Avatar name={b.name} color={b.avatarColor} size={34} />
                <div className="grow">
                  <div className="small strong">{b.name}</div>
                  <div className="tiny muted">@{b.handle} · blocked {timeAgo(b.at)}</div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void run(() => api(`/blocks/${b.id}`, { method: 'DELETE' }), 'Unblocked.')}
                >
                  Unblock
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHead title="Your data" hint="Yours to take, yours to remove." icon="lock" />
        <div className="row wrap">
          <Button size="sm" variant="ghost" icon="arrow" onClick={() => void exportData()}>
            Download everything
          </Button>
          <Button size="sm" variant="quiet" icon="lock" onClick={() => void logout()}>
            Sign out
          </Button>
        </div>

        <div className="divider" style={{ marginTop: 16 }}>
          deleting
        </div>
        <div className="danger-zone">
          <b>Delete my page</b>
          <p className="small" style={{ margin: '6px 0 10px', lineHeight: 1.55 }}>
            This removes your profile, posts, photos, reels, messages, list items and games for good. It cannot
            be undone. If you only want to disappear for a while, hide your page instead.
          </p>
          <Field label="Type DELETE to confirm">
            <input
              className="input"
              value={deleting}
              onChange={(e) => setDeleting(e.target.value)}
              placeholder="DELETE"
              aria-label="Type DELETE to confirm"
            />
          </Field>
          <Button
            size="sm"
            variant="danger"
            icon="trash"
            disabled={deleting.trim().toUpperCase() !== 'DELETE'}
            onClick={async () => {
              try {
                await api('/account/delete', { method: 'POST', body: { confirm: deleting } });
                await logout();
              } catch (err) {
                toast(err instanceof Error ? err.message : 'Could not delete the account.', 'error');
              }
            }}
          >
            Delete everything
          </Button>
        </div>
      </Card>

      <Card>
        <div className="row" style={{ gap: 10 }}>
          <Avatar name={me.name} color={me.avatarColor} size={40} />
          <div className="grow">
            <div className="small strong">{me.name}</div>
            <div className="tiny muted">@{me.handle} · invite code {me.inviteCode}</div>
          </div>
          <Button size="sm" variant="quiet" onClick={() => void refresh()}>
            Refresh
          </Button>
        </div>
      </Card>
    </div>
  );
}
