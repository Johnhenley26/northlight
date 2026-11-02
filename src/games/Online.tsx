import { useCallback, useEffect, useState } from 'react';
import { api, DominoTile, GameTable } from '../api';
import { useApp } from '../store';
import { Avatar, Button, Card, CardHead, Icon, Pill, Segmented } from '../ui';

const GAME_LABEL: Record<string, string> = {
  dominoes: 'Dominoes',
  wordduel: 'Word duel',
  blackjack: 'Blackjack',
};

function MiniAvatar({ name, color, size = 30 }: { name: string; color: string; size?: number }) {
  return <Avatar name={name} color={color} size={size} />;
}

export function TableView({ id, onExit }: { id: string; onExit: () => void }) {
  const { toast } = useApp();
  const [table, setTable] = useState<GameTable | null>(null);
  const [busy, setBusy] = useState(false);
  const [side, setSide] = useState<'left' | 'right'>('right');
  const [guess, setGuess] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await api<{ table: GameTable }>(`/games/${id}`);
      setTable(res.table);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That table went away.', 'error');
      onExit();
    }
  }, [id, onExit, toast]);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 1800);
    return () => window.clearInterval(t);
  }, [load]);

  async function move(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    try {
      const res = await api<{ table: GameTable }>(`/games/${id}/move`, {
        method: 'POST',
        body: { action, ...extra },
      });
      setTable(res.table);
      setGuess('');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That move did not go through.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    if (table?.status === 'playing' && !confirm('Leave the table? Your opponent wins by default.')) return;
    try {
      await api(`/games/${id}/leave`, { method: 'POST' });
    } catch {
      /* table may already be gone */
    }
    onExit();
  }

  if (!table) {
    return (
      <Card>
        <p className="small muted">Opening the table…</p>
        <Button size="sm" variant="quiet" icon="back" onClick={onExit}>
          Back to games
        </Button>
      </Card>
    );
  }

  const st = table.state || {};
  const you = table.you;
  const other = table.players.find((p) => p.id !== you);
  const myTurn = table.status === 'playing' && (table.game !== 'dominoes' || st.turn === you);
  const resultText =
    table.status === 'open'
      ? 'Waiting for someone to join.'
      : table.status === 'done'
      ? table.result === 'won'
        ? 'You won this table.'
        : table.result === 'lost'
        ? 'You lost this one.'
        : 'Draw.'
      : 'In play.';

  return (
    <div className="stack">
      <Card>
        <div className="row-between" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div className="row" style={{ gap: 10 }}>
            <Button size="sm" variant="quiet" icon="back" onClick={onExit}>
              Games
            </Button>
            <h2 className="card-title" style={{ margin: 0 }}>
              {GAME_LABEL[table.game]}
            </h2>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <Pill tone={table.status === 'done' ? 'amber' : 'mint'}>{table.status}</Pill>
            <Button size="sm" variant="ghost" icon="x" onClick={() => void leave()}>
              Leave
            </Button>
          </div>
        </div>

        <div className="row" style={{ gap: 18, marginTop: 14, flexWrap: 'wrap' }}>
          {table.players.map((p) => (
            <div key={p.id} className="row" style={{ gap: 8 }}>
              <MiniAvatar name={p.name} color={p.avatarColor} />
              <div>
                <div className="small strong">
                  {p.name}
                  {p.id === you ? ' (you)' : ''}
                </div>
                <div className="tiny muted">@{p.handle}</div>
              </div>
              {table.game === 'dominoes' && typeof st.counts?.[p.id] === 'number' ? (
                <Pill>{st.counts[p.id]} tiles</Pill>
              ) : null}
            </div>
          ))}
          {other && table.game === 'blackjack' && st.totals ? (
            <Pill>{other.name.split(' ')[0]}: {st.totals[other.id]}</Pill>
          ) : null}
        </div>

        <p className="game-status" style={{ marginTop: 12 }}>{resultText}</p>
      </Card>

      {table.game === 'dominoes' ? (
        <Card>
          <CardHead
            title="The board"
            hint={st.turn === you ? 'Your turn.' : `${other?.name.split(' ')[0] || 'They'} to play.`}
            icon="game"
            action={
              (st.playable || []).length > 0 ? (
                <Segmented
                  small
                  options={[
                    { value: 'left', label: 'Left end' },
                    { value: 'right', label: 'Right end' },
                  ]}
                  value={side}
                  onChange={setSide}
                />
              ) : null
            }
          />
          <div className="board-chain">
            {(st.board || []).length === 0 ? (
              <span className="small muted">No tiles on the board yet.</span>
            ) : (
              st.board.map((t: { a: number; b: number }, i: number) => (
                <span key={i} className="domino">
                  <span>{t.a}</span>
                  <span>{t.b}</span>
                </span>
              ))
            )}
          </div>

          <div style={{ marginTop: 14 }}>
            <div className="tiny muted" style={{ marginBottom: 6 }}>
              Your tiles {(st.hand || []).length ? `· ${st.hand.length} left` : ''}
            </div>
            <div className="tile-row">
              {(st.hand || []).map((t: DominoTile, i: number) => {
                const can = (st.playable || []).includes(`${t[0]}-${t[1]}`);
                return (
                  <button
                    key={`${t[0]}-${t[1]}-${i}`}
                    className={`domino ${can ? 'is-playable' : ''}`}
                    disabled={!can || !myTurn || busy}
                    onClick={() => void move('play', { tile: t, end: side })}
                  >
                    <span>{t[0]}</span>
                    <span>{t[1]}</span>
                  </button>
                );
              })}
              {!(st.hand || []).length ? <span className="small muted">No tiles in hand.</span> : null}
            </div>
          </div>

          <div className="row wrap" style={{ marginTop: 12 }}>
            <Button
              size="sm"
              variant="ghost"
              disabled={!myTurn || busy || st.boneyard === 0}
              onClick={() => void move('draw')}
            >
              Draw from boneyard ({st.boneyard ?? 0})
            </Button>
            <Button
              size="sm"
              variant="quiet"
              disabled={!myTurn || busy || (st.playable || []).length > 0}
              onClick={() => void move('pass')}
            >
              Pass
            </Button>
          </div>

          {(st.log || []).length ? <p className="tiny muted" style={{ marginTop: 10 }}>{st.log[0]}</p> : null}
        </Card>
      ) : null}

      {table.game === 'wordduel' ? (
        <Card>
          <CardHead
            title="Same word, both of you"
            hint="Six guesses each. First to solve it wins."
            icon="spark"
            action={st.answer ? <Pill tone="mint">{st.answer}</Pill> : null}
          />
          <div className="wide-grid">
            {table.players.map((p) => {
              const rows = (st.guesses?.[p.id] || []) as { word: string; marks: string[] }[];
              return (
                <div key={p.id}>
                  <div className="small strong" style={{ marginBottom: 8 }}>
                    {p.name} {p.id === st.solvedBy ? '· solved' : ''}
                  </div>
                  <div className="word-rows">
                    {rows.length === 0 ? <p className="small muted">No guesses yet.</p> : null}
                    {rows.map((g, i) => (
                      <div key={i} className="word-row">
                        {g.word.split('').map((ch, j) => (
                          <span key={j} className={`letter ${g.marks[j]}`}>
                            {ch}
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {table.status === 'playing' && (st.guesses?.[you] || []).length < 6 && !st.solvedBy ? (
            <form
              className="row"
              style={{ marginTop: 12 }}
              onSubmit={(e) => {
                e.preventDefault();
                if (guess.length === 5) void move('guess', { guess });
              }}
            >
              <input
                className="input grow"
                value={guess}
                onChange={(e) => setGuess(e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 5).toUpperCase())}
                placeholder="Five letters"
                maxLength={5}
                aria-label="Your guess"
              />
              <Button type="submit" disabled={busy || guess.length !== 5}>
                Guess
              </Button>
            </form>
          ) : table.status === 'playing' ? (
            <p className="small muted">
              {st.solvedBy === you ? 'You got it — waiting for the table to close.' : 'You are out of guesses. Watch the other side.'}
            </p>
          ) : (
            <p className="small muted">The word was {st.answer}.</p>
          )}
        </Card>
      ) : null}

      {table.game === 'blackjack' ? (
        <Card>
          <CardHead
            title="Against the dealer"
            hint="Dealer stands on 17. You both play the same dealer hand."
            icon="game"
            action={st.finished ? <Pill tone="amber">settled</Pill> : <Pill tone="mint">in play</Pill>}
          />
          <div className="game-stage">
            <div>
              <div className="tiny muted" style={{ marginBottom: 6 }}>
                Dealer {st.finished ? st.dealerTotal : `${st.dealerTotal} + hidden`}
              </div>
              <div className="hand">
                {(st.dealer || []).map((c: { r: string; s: string } | null, i: number) =>
                  c ? (
                    <div key={i} className={`playing-card ${c.s === 'H' || c.s === 'D' ? 'is-red' : ''}`}>
                      {c.r}
                      {c.s === 'H' ? '♥' : c.s === 'D' ? '♦' : c.s === 'S' ? '♠' : '♣'}
                    </div>
                  ) : (
                    <div key={i} className="playing-card is-back" />
                  )
                )}
              </div>
            </div>

            {table.players.map((p) => {
              const cards = (st.hands?.[p.id] || []) as { r: string; s: string }[];
              return (
                <div key={p.id}>
                  <div className="tiny muted" style={{ marginBottom: 6 }}>
                    {p.name} · {st.totals?.[p.id] ?? 0}
                    {st.done?.[p.id] ? ' · stood' : ''}
                    {st.payouts ? ` · pays ${st.payouts[p.id]}x` : ''}
                  </div>
                  <div className="hand">
                    {cards.map((c, i) => (
                      <div key={i} className={`playing-card ${c.s === 'H' || c.s === 'D' ? 'is-red' : ''}`}>
                        {c.r}
                        {c.s === 'H' ? '♥' : c.s === 'D' ? '♦' : c.s === 'S' ? '♠' : '♣'}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {table.status === 'playing' ? (
              <div className="row wrap">
                <Button
                  disabled={busy || st.done?.[you] || st.finished}
                  onClick={() => void move('hit')}
                >
                  Hit
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy || st.done?.[you] || st.finished}
                  onClick={() => void move('stand')}
                >
                  Stand
                </Button>
              </div>
            ) : null}
          </div>
        </Card>
      ) : null}

      {table.status === 'open' ? (
        <Card>
          <div className="row-between">
            <div>
              <b>Waiting for a second player.</b>
              <p className="small muted" style={{ marginTop: 4 }}>
                {table.visibility === 'circle'
                  ? 'Anyone in your circle can join from their Games screen.'
                  : 'Anyone on Northlight can join from the open tables list.'}
              </p>
            </div>
            <Icon name="users" size={22} />
          </div>
        </Card>
      ) : null}
    </div>
  );
}
