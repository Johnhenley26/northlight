import { useEffect, useState } from 'react';
import { api, Listing, Resource } from '../api';
import { mapsUrl, timeAgo, useApp } from '../store';
import {
  Button,
  Card,
  CardHead,
  Empty,
  Field,
  Icon,
  IconName,
  Pill,
  Progress,
  Segmented,
  Sheet,
  Toggle,
} from '../ui';
import { HelpSection } from '../nav';

const TYPE_META: Record<string, { label: string; icon: IconName }> = {
  food: { label: 'Food', icon: 'food' },
  water: { label: 'Water', icon: 'water' },
  shelter: { label: 'Shelter', icon: 'bed' },
  shower: { label: 'Shower', icon: 'shower' },
  clinic: { label: 'Clinic', icon: 'clinic' },
  charging: { label: 'Charging', icon: 'plug' },
  daycenter: { label: 'Day center', icon: 'user' },
};

const FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'Everything' },
  { value: 'food', label: 'Food' },
  { value: 'water', label: 'Water' },
  { value: 'shelter', label: 'Beds' },
  { value: 'shower', label: 'Showers' },
  { value: 'clinic', label: 'Health' },
  { value: 'charging', label: 'Charge' },
];

function ResourceCard({
  r,
  onCheckIn,
  onDeliver,
}: {
  r: Resource;
  onCheckIn: () => void;
  onDeliver: () => void;
}) {
  const meta = TYPE_META[r.type] ?? { label: r.type, icon: 'pin' as IconName };
  return (
    <div className="res">
      <div className="res-head">
        <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
          <span className="type-badge">
            <Icon name={meta.icon} size={19} />
          </span>
          <div>
            <div className="res-name">{r.name}</div>
            <div className="res-org">
              {r.org} · {r.address}
            </div>
          </div>
        </div>
        <Pill tone={r.openToday ? 'mint' : 'neutral'} icon="clock">
          {r.openToday ? 'Today' : 'Closed today'}
        </Pill>
      </div>

      <div className="res-meta">
        <span className="strong" style={{ color: '#dfe9ed' }}>
          {r.hours}
        </span>
        {r.accessible ? <span>· step-free</span> : null}
      </div>

      <div className="row wrap" style={{ gap: 6 }}>
        {r.tags.map((t) => (
          <span key={t} className="pill">
            {t}
          </span>
        ))}
      </div>

      <p className="res-note">{r.note}</p>

      <div className="res-actions">
        {r.type === 'food' ? (
          <Button size="sm" variant="primary" icon="food" onClick={onDeliver}>
            Deliver to me
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" icon="pin" onClick={onCheckIn}>
          Check in here
        </Button>
        <a className="btn btn-ghost btn-sm" href={mapsUrl(r.lat, r.lng, r.name)} target="_blank" rel="noreferrer">
          <Icon name="map" size={15} />
          <span>Directions</span>
        </a>
      </div>
    </div>
  );
}

export function DeliverySheet({
  resource,
  resources,
  onClose,
}: {
  resource: Resource | null;
  resources: Resource[];
  onClose: () => void;
}) {
  const { data, run } = useApp();
  const kitchens = resources.filter((r) => r.type === 'food');
  const [pickId, setPickId] = useState(resource?.id ?? kitchens[0]?.id ?? '');
  const [meal, setMeal] = useState('Hot dinner');
  const [servings, setServings] = useState(1);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (resource) setPickId(resource.id);
  }, [resource]);

  const me = data?.me;
  const target = me?.shareLocation && me?.location ? me.location.label : me?.lastKnown?.label ?? null;

  async function submit() {
    if (!pickId) return;
    setBusy(true);
    const ok = await run(
      () =>
        api('/deliveries', {
          method: 'POST',
          body: { resourceId: pickId, meal, servings, note },
        }),
      'Request sent. Your tracker is under Help → Deliveries.'
    );
    setBusy(false);
    if (ok) {
      setNote('');
      setServings(1);
      onClose();
    }
  }

  return (
    <Sheet
      open={!!resource}
      onClose={onClose}
      title="A meal brought to you"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button full onClick={() => void submit()} disabled={busy || !target || !pickId}>
            {busy ? 'Sending…' : 'Request this meal'}
          </Button>
        </>
      }
    >
      <Field label="Kitchen" htmlFor="kitchen">
        <select id="kitchen" className="input" value={pickId} onChange={(e) => setPickId(e.target.value)}>
          {kitchens.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name} · {k.hours}
            </option>
          ))}
        </select>
      </Field>

      <Field label="What would help most?" htmlFor="meal">
        <input
          id="meal"
          className="input"
          value={meal}
          onChange={(e) => setMeal(e.target.value)}
          placeholder="Hot dinner, no pork"
        />
      </Field>

      <div className="row-between">
        <div>
          <span className="field-label">How many people</span>
          <p className="field-hint">No limit on kindness — up to six meals.</p>
        </div>
        <div className="stepper">
          <button onClick={() => setServings((s) => Math.max(1, s - 1))} aria-label="Fewer meals" type="button">
            −
          </button>
          <span>{servings}</span>
          <button onClick={() => setServings((s) => Math.min(6, s + 1))} aria-label="More meals" type="button">
            +
          </button>
        </div>
      </div>

      <Field label="Anything the kitchen should know?" htmlFor="note" hint="Allergies, a gate code, where to find you.">
        <textarea
          id="note"
          className="textarea"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="I am behind the blue tent near the west entrance."
        />
      </Field>

      <div className="note-box">
        {target ? (
          <>
            <b>Delivering to:</b> {target}
            <br />
            This is the spot you last shared. Change it under My spot before ordering if you are somewhere
            else.
          </>
        ) : (
          <>
            <b>No spot yet.</b> Save a spot or check in at a place first, so a rider can find you. Nothing is
            charged — meals, delivery and packaging are free.
          </>
        )}
      </div>
      <p className="tiny muted">
        Northlight volunteers deliver on bikes and by car. Times are estimates and riders may call out your
        first name only.
      </p>
    </Sheet>
  );
}

export default function HelpScreen({
  section,
  setSection,
}: {
  section: HelpSection;
  setSection: (s: HelpSection) => void;
}) {
  const { data, run, toast } = useApp();
  const [filter, setFilter] = useState('all');
  const [deliverFor, setDeliverFor] = useState<Resource | null>(null);
  const [applying, setApplying] = useState<Listing | null>(null);
  const [applyNote, setApplyNote] = useState('');
  const [contactOk, setContactOk] = useState(true);
  const [busy, setBusy] = useState(false);

  if (!data) return null;
  const resources = (data.resources ?? []).filter((r) => filter === 'all' || r.type === filter);
  const listings = data.listings ?? [];
  const free = listings.filter((l) => l.plan === 'free');
  const paid = listings.filter((l) => l.plan === 'paid');
  const active = data.deliveries.filter((d) => d.stage !== 'delivered');
  const past = data.deliveries.filter((d) => d.stage === 'delivered');

  function checkIn(r: Resource) {
    void run(
      () =>
        api('/location', {
          method: 'POST',
          body: { resourceId: r.id, precision: data!.me.location?.precision ?? 'area' },
        }),
      `Checked in at ${r.name}. Only your circle sees it.`
    );
  }

  async function apply() {
    if (!applying) return;
    setBusy(true);
    const ok = await run(
      () =>
        api('/residency/apply', {
          method: 'POST',
          body: { listingId: applying.id, note: applyNote, contactOk },
        }),
      'Application in. A navigator reviews it within 3 business days.'
    );
    setBusy(false);
    if (ok) {
      setApplying(null);
      setApplyNote('');
      setSection('residency');
    }
  }

  return (
    <div className="screen">
      <div className="section-head">
        <div>
          <h1 className="section-title">Help, now</h1>
          <p className="section-sub">
            Food, water, showers, a bed tonight, and a room of your own. Every listing shows hours and
            whether it is open today. Nothing here costs money.
          </p>
        </div>
      </div>

      <Segmented
        options={[
          { value: 'food', label: 'Food & water' },
          { value: 'residency', label: 'Residency' },
          { value: 'deliveries', label: 'Deliveries', badge: active.length },
        ]}
        value={section}
        onChange={setSection}
      />

      {section === 'food' ? (
        <>
          <div className="row wrap">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                className={`chip ${filter === f.value ? 'is-active' : ''}`}
                onClick={() => setFilter(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="res-list">
            {resources.length === 0 ? (
              <Empty icon="water" title="Nothing in this filter" body="Try “Everything” to see all nearby resources." />
            ) : (
              resources.map((r) => (
                <ResourceCard
                  key={r.id}
                  r={r}
                  onCheckIn={() => checkIn(r)}
                  onDeliver={() => setDeliverFor(r)}
                />
              ))
            )}
          </div>

          <div className="note-box">
            <b>Can't get to a site?</b> Any kitchen marked “Delivery available” can send a hot meal to the
            spot you shared. No address, no phone number, no payment.
          </div>
        </>
      ) : null}

      {section === 'residency' ? (
        <>
          {data.residencyApps.length > 0 ? (
            <Card>
              <CardHead title="Your applications" hint="You will hear from a navigator here, in messages." icon="bed" />
              <div className="stack-tight">
                {data.residencyApps.map((a) => (
                  <div key={a.id} className="status-strip">
                    <span className="type-badge">
                      <Icon name="bed" size={18} />
                    </span>
                    <div className="grow">
                      <div className="small strong">{a.listing?.name ?? 'Residency application'}</div>
                      <div className="tiny muted">
                        {a.listing?.plan === 'free' ? 'Free residency' : `$${a.listing?.monthlyCost ?? 0}/month`}{' '}
                        · submitted {timeAgo(a.at)}
                      </div>
                    </div>
                    <Pill tone="amber">{a.status}</Pill>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          <div className="residency-hero">
            <span className="eyebrow">Two ways to have an address again</span>
            <h2 className="display" style={{ fontSize: '1.35rem' }}>
              Free residency, or a low-cost room of your own.
            </h2>
            <p className="small" style={{ color: '#cbdad6', lineHeight: 1.55 }}>
              Free is not the lesser option — it is the housing-first option: no rent, no deposit, no
              sobriety requirement, no credit check. The paid rooms exist for people with a little income who
              want their own lease. Vouchers are welcome in both.
            </p>
          </div>

          <div className="section-head">
            <div>
              <h2 className="section-title" style={{ fontSize: '1.3rem' }}>
                Free residency
              </h2>
              <p className="section-sub">$0 rent. $0 deposit. A lease in your name.</p>
            </div>
            <Pill tone="mint" icon="heart">
              No cost, ever
            </Pill>
          </div>

          <div className="res-list">
            {free.map((l) => (
              <div key={l.id} className="listing is-free">
                <div className="row-between">
                  <div>
                    <h3 className="display" style={{ fontSize: '1.2rem' }}>
                      {l.name}
                    </h3>
                    <div className="tiny muted">{l.operator}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="price">
                      $0<small> / month</small>
                    </div>
                    <Pill tone="mint" icon="check">
                      {l.availability}
                    </Pill>
                  </div>
                </div>

                <p className="small" style={{ color: '#d3e2dd', lineHeight: 1.55 }}>
                  {l.tagline}
                </p>

                <div className="amenities">
                  {l.amenities.map((a) => (
                    <span key={a} className="pill">
                      {a}
                    </span>
                  ))}
                </div>

                <ul className="tick-list">
                  {l.eligibility.map((e) => (
                    <li key={e}>
                      <Icon name="check" size={15} />
                      <span>{e}</span>
                    </li>
                  ))}
                </ul>

                <p className="res-note">{l.note}</p>

                <div className="row-between">
                  <span className="tiny muted">
                    {l.address} · {l.unitsLeft} place{l.unitsLeft === 1 ? '' : 's'} left
                  </span>
                  <Button
                    size="sm"
                    variant="mint"
                    icon="bed"
                    onClick={() => {
                      setApplying(l);
                      setApplyNote('');
                    }}
                  >
                    Apply free
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="section-head" style={{ marginTop: 8 }}>
            <div>
              <h2 className="section-title" style={{ fontSize: '1.3rem' }}>
                Paid residency
              </h2>
              <p className="section-sub">
                Subsidized rooms with a monthly cost. Vouchers accepted, no credit check, deposit can be paid
                in installments.
              </p>
            </div>
            <Pill tone="amber" icon="bed">
              Income-based
            </Pill>
          </div>

          <div className="res-list">
            {paid.map((l) => (
              <div key={l.id} className="listing is-paid">
                <div className="row-between">
                  <div>
                    <h3 className="display" style={{ fontSize: '1.2rem' }}>
                      {l.name}
                    </h3>
                    <div className="tiny muted">{l.operator}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="price">
                      ${l.monthlyCost}
                      <small> / month</small>
                    </div>
                    <Pill tone={l.availability === 'Open now' ? 'mint' : 'neutral'} icon="check">
                      {l.availability}
                    </Pill>
                  </div>
                </div>

                <p className="small" style={{ color: '#e6dccb', lineHeight: 1.55 }}>
                  {l.description}
                </p>

                <div className="amenities">
                  {l.amenities.map((a) => (
                    <span key={a} className="pill">
                      {a}
                    </span>
                  ))}
                </div>

                <ul className="tick-list">
                  {l.eligibility.map((e) => (
                    <li key={e}>
                      <Icon name="check" size={15} />
                      <span>{e}</span>
                    </li>
                  ))}
                </ul>

                <div className="row wrap" style={{ gap: 8 }}>
                  <Pill tone="amber">Deposit ${l.deposit}</Pill>
                  <Pill>Vouchers accepted</Pill>
                  <Pill>{l.unitsLeft} available</Pill>
                </div>

                <p className="res-note">{l.note}</p>

                <div className="row-between">
                  <span className="tiny muted">{l.address}</span>
                  <Button
                    size="sm"
                    variant="primary"
                    icon="bed"
                    onClick={() => {
                      setApplying(l);
                      setApplyNote('');
                    }}
                  >
                    Apply
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="note-box">
            <b>Applying does not cost anything and does not commit you.</b> A navigator reads every
            application. If ID or paperwork is missing, they will help you get it — that is their job, and it
            is not a reason for us to turn you away.
          </div>
        </>
      ) : null}

      {section === 'deliveries' ? (
        <>
          <div className="stack">
            {active.length === 0 ? (
              <Empty
                icon="food"
                title="No meal on the way"
                body="Order a hot meal from any partner kitchen and a volunteer rider brings it to your spot."
                action={
                  <Button size="sm" onClick={() => setSection('food')}>
                    Find a kitchen
                  </Button>
                }
              />
            ) : (
              active.map((d) => (
                <Card key={d.id}>
                  <CardHead
                    title={`${d.meal}`}
                    hint={`${d.resourceName} · ${d.servings} serving${d.servings === 1 ? '' : 's'}`}
                    icon="food"
                    action={<Pill tone="amber">{d.minutesLeft > 0 ? `${d.minutesLeft} min` : 'almost there'}</Pill>}
                  />
                  <Progress value={d.progress} />
                  <div className="row-between" style={{ marginTop: 8 }}>
                    <span className="small strong">{d.stageLabel}</span>
                    <span className="tiny muted">
                      {d.courier} · to {d.locationLabel}
                    </span>
                  </div>
                  {d.note ? (
                    <p className="tiny muted" style={{ marginTop: 8 }}>
                      Your note: “{d.note}”
                    </p>
                  ) : null}
                  <p className="tiny muted" style={{ marginTop: 10 }}>
                    Ordered {timeAgo(d.at)}. Riders will use your first name only.
                  </p>
                </Card>
              ))
            )}

            {past.length > 0 ? (
              <Card>
                <CardHead title="Delivered" icon="check" />
                <div className="stack-tight">
                  {past.map((d) => (
                    <div key={d.id} className="row-between">
                      <div>
                        <div className="small strong">{d.meal}</div>
                        <div className="tiny muted">
                          {d.resourceName} · {timeAgo(d.at)}
                        </div>
                      </div>
                      <Pill tone="mint">delivered</Pill>
                    </div>
                  ))}
                </div>
              </Card>
            ) : null}
          </div>
        </>
      ) : null}

      <DeliverySheet resource={deliverFor} resources={data.resources ?? []} onClose={() => setDeliverFor(null)} />

      <Sheet
        open={!!applying}
        onClose={() => setApplying(null)}
        title={applying ? `Apply: ${applying.name}` : 'Apply'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setApplying(null)}>
              Close
            </Button>
            <Button full onClick={() => void apply()} disabled={busy}>
              {busy ? 'Sending…' : 'Send my application'}
            </Button>
          </>
        }
      >
        {applying ? (
          <>
            <div className="note-box">
              <b>{applying.plan === 'free' ? 'Free residency' : `$${applying.monthlyCost} per month`}</b>
              <br />
              {applying.tagline}
            </div>
            <Field
              label="Anything a navigator should know?"
              htmlFor="apply-note"
              hint="Optional. What you have, what you need, the best way to reach you."
            >
              <textarea
                id="apply-note"
                className="textarea"
                value={applyNote}
                onChange={(e) => setApplyNote(e.target.value)}
                placeholder="I am staying at Willow shelter and I can meet any weekday morning."
              />
            </Field>
            <Toggle
              label="A navigator may message me here"
              description="Messages stay inside Northlight. They will never call or show up without asking."
              checked={contactOk}
              onChange={setContactOk}
            />
            <p className="tiny muted">
              No ID required to apply. No fee. If you are already on another waiting list, that is fine too.
            </p>
          </>
        ) : null}
      </Sheet>
    </div>
  );
}
