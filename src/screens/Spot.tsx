import { useState } from 'react';
import { api, Resource } from '../api';
import { mapsUrl, timeAgo, useApp } from '../store';
import { Button, Card, CardHead, Empty, Icon, Pill, Segmented, Sheet, Toggle } from '../ui';
import { Go } from '../nav';

function metres(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const dLat = (a.lat - b.lat) * 111000;
  const dLng = (a.lng - b.lng) * 111000 * Math.cos((a.lat * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

function project(lat: number, lng: number, center: { lat: number; lng: number }) {
  const x = 50 + ((lng - center.lng) / 0.03) * 100;
  const y = 50 - ((lat - center.lat) / 0.022) * 100;
  return { left: Math.max(7, Math.min(93, x)), top: Math.max(9, Math.min(91, y)) };
}

const TYPE_ICON = {
  food: 'food',
  water: 'water',
  shelter: 'bed',
  shower: 'shower',
  clinic: 'clinic',
  charging: 'plug',
  daycenter: 'user',
} as const;

export default function SpotScreen({ go }: { go: Go }) {
  const { data, run, toast } = useApp();
  const [sheet, setSheet] = useState<null | 'checkin' | 'area'>(null);
  const [geoBusy, setGeoBusy] = useState(false);

  if (!data) return null;
  const { me, circle } = data;
  const resources = data.resources ?? [];
  const anchor = me.location ?? me.lastKnown ?? { lat: 45.5202, lng: -122.6712 };
  const nearby = [...resources].sort((a, b) => metres(a, anchor) - metres(b, anchor)).slice(0, 5);

  const seen = new Set<string>();
  const areas = resources.filter((r) => {
    if (seen.has(r.name)) return false;
    seen.add(r.name);
    return true;
  }).slice(0, 8);

  function useMyLocation() {
    if (!navigator.geolocation) {
      toast('This browser cannot read a location. Check in at a place instead.', 'error');
      return;
    }
    setGeoBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void run(
          () =>
            api('/location', {
              method: 'POST',
              body: {
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                label: 'My current location',
                precision: me.location?.precision ?? 'area',
              },
            }),
          'Spot saved. Only the people in your circle can see it.'
        ).finally(() => setGeoBusy(false));
      },
      () => {
        setGeoBusy(false);
        toast('No location from this device. Pick a place below — that works just as well.', 'error');
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  }

  function checkIn(r: Resource) {
    setSheet(null);
    void run(
      () =>
        api('/location', {
          method: 'POST',
          body: { resourceId: r.id, precision: me.location?.precision ?? 'area' },
        }),
      `Checked in at ${r.name}. Only your circle can see it.`
    );
  }

  function setArea(r: Resource) {
    setSheet(null);
    void run(
      () =>
        api('/location', {
          method: 'POST',
          body: { lat: r.lat, lng: r.lng, label: `Near ${r.name}`, precision: 'area' },
        }),
      `Area saved: near ${r.name}.`
    );
  }

  return (
    <div className="screen">
      <div className="section-head">
        <div>
          <h1 className="section-title">My spot</h1>
          <p className="section-sub">
            One switch decides whether anyone can see where you are. Your last known spot is always kept —
            for you, never as a public record.
          </p>
        </div>
        {me.shareLocation ? (
          <Pill tone="mint" icon="shield">
            Sharing with {circle.length} {circle.length === 1 ? 'person' : 'people'}
          </Pill>
        ) : (
          <Pill icon="lock">Private</Pill>
        )}
      </div>

      <Card>
        <div className="map-canvas" role="img" aria-label="Map of your spot and nearby resources">
          {me.shareLocation && me.location ? (
            <div
              className="map-pin me"
              style={(() => {
                const p = project(me.location.lat, me.location.lng, anchor);
                return { left: `${p.left}%`, top: `${p.top}%` };
              })()}
            >
              <span className="map-dot" />
              <span className="map-tag">You</span>
            </div>
          ) : null}
          {nearby.map((r) => {
            const p = project(r.lat, r.lng, anchor);
            return (
              <div key={r.id} className="map-pin" style={{ left: `${p.left}%`, top: `${p.top}%` }}>
                <span className="map-dot" />
                <span className="map-tag">{r.name}</span>
              </div>
            );
          })}
          <div className="map-legend">
            <span>
              <i style={{ background: 'var(--amber)' }} />
              You
            </span>
            <span>
              <i style={{ background: 'var(--mint)' }} />
              Resources
            </span>
          </div>
        </div>

        <div className="row-between" style={{ marginTop: 14 }}>
          <div className="grow">
            <div className="eyebrow">{me.shareLocation ? 'Visible to your circle' : 'Only you'}</div>
            <h2 className="spot-label" style={{ marginTop: 4 }}>
              {me.location?.label || me.lastKnown?.label || 'No spot saved yet'}
            </h2>
            <p className="tiny muted" style={{ marginTop: 4 }}>
              {me.location
                ? `Updated ${timeAgo(me.location.at)} · ${
                    me.location.precision === 'area' ? 'area only (rounded)' : 'exact coordinates'
                  }`
                : 'Add a spot so your circle knows you are okay.'}
            </p>
          </div>
          {me.location ? (
            <a
              className="btn btn-ghost btn-sm"
              href={mapsUrl(me.location.lat, me.location.lng)}
              target="_blank"
              rel="noreferrer"
            >
              <Icon name="map" size={15} />
              <span>Open map</span>
            </a>
          ) : null}
        </div>
      </Card>

      <div className="wide-grid">
        <div className="stack">
          <Card>
            <CardHead title="Update my spot" hint="Three ways. Pick whichever fits what you have right now." icon="pin" />
            <div className="stack-tight">
              <Button variant="primary" icon="compass" onClick={useMyLocation} disabled={geoBusy} full>
                {geoBusy ? 'Reading your location…' : 'Use my current location'}
              </Button>
              <Button variant="ghost" icon="pin" onClick={() => setSheet('checkin')} full>
                Check in at a place
              </Button>
              <Button variant="ghost" icon="map" onClick={() => setSheet('area')} full>
                Just say what area I am in
              </Button>
            </div>
            <p className="field-hint" style={{ marginTop: 12 }}>
              “Check in at a place” uses the address of a kitchen, shelter or library — good when you would
              rather not share a raw GPS point.
            </p>
          </Card>

          <Card>
            <CardHead title="Who can see it" hint="Everyone else sees nothing at all." icon="users" />
            {circle.length === 0 ? (
              <Empty
                icon="users"
                title="No one in your circle yet"
                body="Add family or friends and they will be the only people who can see a spot you share."
                action={
                  <Button size="sm" variant="ghost" onClick={() => go('circle')}>
                    Find people
                  </Button>
                }
              />
            ) : (
              <div className="visible-list">
                {circle.map((p) => (
                  <div key={p.id} className="visible-row">
                    <span
                      className="avatar"
                      style={{ width: 36, height: 36, background: p.avatarColor, fontSize: 14 }}
                    >
                      {(p.name || '?')
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((x) => x[0])
                        .join('')}
                    </span>
                    <div className="grow">
                      <div className="small strong">{p.name}</div>
                      <div className="tiny muted">
                        {p.spot.shared
                          ? `${p.spot.label} · ${timeAgo(p.spot.at)}`
                          : p.spot.lastKnown
                          ? `Sharing off · last at ${p.spot.lastKnown.label}, ${timeAgo(p.spot.lastKnown.at)}`
                          : 'Sharing off · no last spot'}
                      </div>
                    </div>
                    {p.spot.shared ? <Pill tone="mint">live</Pill> : <Pill>off</Pill>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="stack">
          <Card>
            <CardHead title="Sharing controls" icon="shield" />
            <Toggle
              label="Share my location"
              description={
                me.shareLocation
                  ? 'Your circle can see your current spot.'
                  : 'Nobody can see where you are. Your last spot is still saved for you.'
              }
              checked={!!me.shareLocation}
              onChange={(next) => {
                if (next && !me.location) {
                  toast('Add a spot first — then sharing can switch on.', 'info');
                  return;
                }
                void run(
                  () => api('/location/settings', { method: 'PATCH', body: { shareLocation: next } }),
                  next ? 'Sharing is on.' : 'Sharing is off.'
                );
              }}
            />
            <Toggle
              label="Keep a last known spot"
              description="If sharing is off, your circle sees only “location off”. With this on, they can see the place you last checked in, with the date."
              checked={me.shareLastKnown}
              onChange={(next) =>
                void run(() =>
                  api('/location/settings', { method: 'PATCH', body: { shareLastKnown: next } })
                )
              }
            />
            <div style={{ marginTop: 14 }}>
              <span className="field-label">Detail level</span>
              <div style={{ marginTop: 8 }}>
                <Segmented
                  options={[
                    { value: 'area', label: 'Area only' },
                    { value: 'exact', label: 'Exact spot' },
                  ]}
                  value={(me.location?.precision ?? 'area') as 'area' | 'exact'}
                  onChange={(precision) =>
                    void run(() => api('/location/settings', { method: 'PATCH', body: { precision } }))
                  }
                />
              </div>
            </div>
          </Card>

          <Card>
            <CardHead title="Your last known spot" hint="Recorded every time you check in — even with sharing off." icon="clock" />
            {me.lastKnown ? (
              <div className="stack-tight">
                <div className="row-between">
                  <span className="small strong">{me.lastKnown.label}</span>
                  <Pill>{timeAgo(me.lastKnown.at)}</Pill>
                </div>
                <p className="tiny muted">
                  Only you and the people in your circle can see this, and only while “keep a last known
                  spot” is on.
                </p>
              </div>
            ) : (
              <p className="small muted">Nothing recorded yet.</p>
            )}
          </Card>

          <div className="note-box">
            <b>How this works.</b> Your coordinates are stored on your own profile, never shared with
            partners or posted publicly. Switch sharing off and the next person who opens your profile sees
            “location off”. No history of your movements is kept beyond the single last known spot.
          </div>
        </div>
      </div>

      <Sheet open={sheet === 'checkin'} onClose={() => setSheet(null)} title="Check in at a place">
        <p className="small muted">
          These are nearby places that already appear in Northlight. Your circle sees the place, not a
          precise pin.
        </p>
        <div className="stack-tight">
          {nearby.map((r) => (
            <button key={r.id} className="area-btn" onClick={() => checkIn(r)}>
              <span className="row" style={{ gap: 8 }}>
                <Icon name={TYPE_ICON[r.type]} size={16} />
                <span style={{ fontWeight: 600 }}>{r.name}</span>
              </span>
              <span className="sub">{r.address}</span>
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet open={sheet === 'area'} onClose={() => setSheet(null)} title="Which area are you in?">
        <p className="small muted">
          Area check-ins round your spot to roughly a five-minute walk. Good for a first message to family.
        </p>
        <div className="area-grid">
          {areas.map((r) => (
            <button key={r.id} className="area-btn" onClick={() => setArea(r)}>
              {r.name}
              <span className="sub">{r.address}</span>
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}
