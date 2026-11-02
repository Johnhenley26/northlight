import { useState } from 'react';
import { api, SosResponse } from './api';
import { clockTime, useApp } from './store';
import { Button, Sheet } from './ui';

const KINDS = [
  { value: 'help', label: 'Local help', hint: 'Outreach, a welfare check, someone to come to you' },
  { value: 'ambulance', label: 'Ambulance', hint: 'Injury, chest pain, trouble breathing' },
  { value: 'police', label: 'Police', hint: 'Immediate danger, violence, a crime in progress' },
  { value: 'narcan', label: 'Narcan', hint: 'Overdose — naloxone and 911' },
] as const;

type Kind = (typeof KINDS)[number]['value'];

export default function SosButton() {
  const { run, toast } = useApp();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>('help');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SosResponse | null>(null);

  async function send() {
    setBusy(true);
    try {
      const res = await api<SosResponse>('/sos', { method: 'POST', body: { kind, note } });
      setResult(res);
      await run(async () => res, undefined);
      toast(
        res.alert.circleNotified > 0
          ? `Your circle was told (${res.alert.circleNotified}). Call 911 now if this is an emergency.`
          : 'Alert saved. Call 911 now if this is an emergency.',
        'error'
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : 'The alert did not send.', 'error');
    } finally {
      setBusy(false);
    }
  }

  function close() {
    setOpen(false);
    setResult(null);
    setNote('');
    setKind('help');
  }

  return (
    <>
      <button className="sos-fab" onClick={() => setOpen(true)} aria-label="Open emergency SOS" title="Emergency SOS">
        SOS
      </button>

      <Sheet open={open} onClose={close} title={result ? 'Help is coming into view' : 'Emergency'}>
        {!result ? (
          <>
            <p className="small" style={{ lineHeight: 1.6, marginTop: 0 }}>
              Pick what you need. Northlight will tell the people in your circle where you last were and put
              the real phone numbers in front of you.
            </p>

            <div className="sos-kinds">
              {KINDS.map((k) => (
                <button
                  key={k.value}
                  type="button"
                  className={`sos-kind ${kind === k.value ? 'is-active' : ''}`}
                  onClick={() => setKind(k.value)}
                  aria-pressed={kind === k.value}
                >
                  <b>{k.label}</b>
                  <span>{k.hint}</span>
                </button>
              ))}
            </div>

            <label className="field" style={{ marginTop: 14 }}>
              <span className="field-label">Anything they should know? (optional)</span>
              <textarea
                className="textarea"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Alley behind the kitchen, wearing a green jacket…"
                maxLength={400}
              />
            </label>

            <div className="sos-warn">
              <b>Northlight does not call 911 for you.</b> It alerts your circle and shows you the numbers.
              If life is in danger, call 911 first — then press send here so people know where you are.
            </div>

            <div style={{ marginTop: 14 }}>
              <Button variant="danger" size="lg" full icon="siren" onClick={() => void send()} disabled={busy}>
                {busy ? 'Sending…' : `Send ${KINDS.find((k) => k.value === kind)?.label} alert`}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="note-box" style={{ borderColor: 'rgba(255,139,126,0.4)' }}>
              <b>{result.alert.kindLabel} alert sent at {clockTime(result.alert.at)}.</b>
              <div style={{ marginTop: 6 }}>
                {result.alert.circleNotified > 0
                  ? `${result.alert.circleNotified} ${result.alert.circleNotified === 1 ? 'person' : 'people'} in your circle were told. Last spot: ${result.alert.locationLabel}.`
                  : `Nobody is in your circle yet, so no one was notified. Last spot: ${result.alert.locationLabel}.`}
              </div>
            </div>

            <p className="tiny muted" style={{ lineHeight: 1.55 }}>{result.note}</p>

            <div className="sos-lines">
              {result.lines.map((line) => (
                <a key={line.number} className="sos-line" href={`tel:${line.number.replace(/[^\d+]/g, '')}`}>
                  <span>{line.label}</span>
                  <b>{line.number}</b>
                </a>
              ))}
            </div>

            <div className="row" style={{ marginTop: 14, gap: 8 }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  try {
                    await api(`/sos/${result.alert.id}/cancel`, { method: 'POST' });
                    toast('Alert closed. Your circle can stand down.', 'ok');
                    close();
                  } catch (err) {
                    toast(err instanceof Error ? err.message : 'Could not close it.', 'error');
                  }
                }}
              >
                I am safe — close alert
              </Button>
              <Button variant="quiet" size="sm" onClick={close}>
                Done
              </Button>
            </div>
          </>
        )}
      </Sheet>
    </>
  );
}
