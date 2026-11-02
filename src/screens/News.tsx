import { useEffect, useMemo, useState } from 'react';
import { api, NewsPayload } from '../api';
import { timeAgo, useApp } from '../store';
import { Button, Card, CardHead, Pill, Segmented } from '../ui';

type Scope = 'world' | 'us' | 'state';
type StateRow = { code: string; name: string };

const QUICK = ['OR', 'CA', 'WA', 'TX', 'NY', 'FL', 'PR', 'VI'];

export default function NewsScreen() {
  const { toast } = useApp();
  const [scope, setScope] = useState<Scope>('world');
  const [code, setCode] = useState('OR');
  const [states, setStates] = useState<StateRow[]>([]);
  const [payload, setPayload] = useState<NewsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    void api<{ states: StateRow[] }>('/news/states')
      .then((r) => setStates(r.states))
      .catch(() => setStates([]));
  }, []);

  useEffect(() => {
    let live = true;
    setLoading(true);
    api<NewsPayload>(`/news?scope=${scope}&state=${code}`)
      .then((p) => {
        if (live) setPayload(p);
      })
      .catch((err) => {
        if (live) toast(err instanceof Error ? err.message : 'News is not loading right now.', 'error');
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [scope, code, nonce, toast]);

  const groups = useMemo(() => {
    const territories = states.filter((s) => s.code === 'PR' || s.code === 'VI');
    const mainland = states.filter((s) => s.code !== 'PR' && s.code !== 'VI');
    return { mainland, territories };
  }, [states]);

  return (
    <div className="screen">
      <div className="section-head">
        <div>
          <h1 className="section-title">News</h1>
          <p className="section-sub">
            The world, the country, and the place you are standing. Headlines are live from Google News —
            opening one leaves Northlight.
          </p>
        </div>
      </div>

      <Segmented
        options={[
          { value: 'world', label: 'World' },
          { value: 'us', label: 'United States' },
          { value: 'state', label: 'Local' },
        ]}
        value={scope}
        onChange={setScope}
      />

      <Card>
        <div className="news-toolbar">
          {scope === 'state' ? (
            <>
              <select
                className="input"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                aria-label="Choose a state or territory"
                style={{ maxWidth: 260 }}
              >
                <optgroup label="States & DC">
                  {groups.mainland.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Territories">
                  {groups.territories.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.name}
                    </option>
                  ))}
                </optgroup>
              </select>
              <div className="row wrap" style={{ gap: 6 }}>
                {QUICK.map((c) => (
                  <button
                    key={c}
                    className={`chip ${code === c ? 'is-active' : ''}`}
                    onClick={() => setCode(c)}
                  >
                    {states.find((s) => s.code === c)?.name ?? c}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <span className="game-status">
              {scope === 'world' ? 'World headlines' : 'National headlines'} · updated{' '}
              {payload ? timeAgo(payload.fetchedAt) : '…'}
            </span>
          )}

          <Button size="sm" variant="ghost" icon="compass" onClick={() => setNonce((n) => n + 1)}>
            Refresh
          </Button>
        </div>

        <CardHead
          title={payload?.stateName || (scope === 'world' ? 'Around the world' : scope === 'us' ? 'Across the country' : 'Local')}
          hint={
            payload?.live
              ? `Live feed${payload.cached ? ' (cached)' : ''} · ${payload.items.length} stories`
              : 'Live headlines are unreachable right now.'
          }
          icon="news"
          action={payload?.live ? <Pill tone="mint">live</Pill> : <Pill tone="amber">offline</Pill>}
        />

        {loading && !payload ? (
          <p className="small muted">Loading headlines…</p>
        ) : payload && payload.items.length > 0 ? (
          <div className="news-list">
            {payload.items.map((item, i) => (
              <a
                key={`${item.url}-${i}`}
                className="news-item"
                href={item.url}
                target="_blank"
                rel="noreferrer"
              >
                <h3>{item.title}</h3>
                <div className="news-meta">
                  <b>{item.source}</b>
                  <span>{timeAgo(item.at)}</span>
                </div>
                {item.summary && item.summary.length > 40 ? (
                  <p className="news-summary">{item.summary.slice(0, 160)}…</p>
                ) : null}
              </a>
            ))}
          </div>
        ) : (
          <div className="note-box">
            <b>No headlines came back.</b> {payload?.error || 'Check the connection and try Refresh.'}
          </div>
        )}

        <p className="tiny muted" style={{ marginTop: 14, lineHeight: 1.5 }}>
          Northlight shows headline, source and link only. It does not rewrite the news or decide what you
          should read.
        </p>
      </Card>
    </div>
  );
}
