import { useEffect, useState } from 'react';
import { api, GameTable } from '../api';
import { timeAgo, useApp } from '../store';
import { Button, Card, CardHead, Icon, IconName, Pill, Segmented } from '../ui';
import { Blackjack, DailyWord, DominoesSolo, Poker, Solitaire, Tetris, WordGuess } from '../games/Solo';
import { TableView } from '../games/Online';

type Lobby = {
  games: string[];
  open: GameTable[];
  mine: (GameTable & { result?: 'won' | 'lost' | 'draw' | null })[];
  daily: { date: string; played: boolean; guesses: number };
};

type SoloKey = 'daily' | 'word' | 'dominoes' | 'blackjack' | 'poker' | 'solitaire' | 'tetris';

const SOLO: { key: SoloKey; label: string; note: string; icon: IconName; badge?: string }[] = [
  { key: 'daily', label: 'Daily word', note: 'Same five-letter puzzle for everyone', icon: 'spark' },
  { key: 'word', label: 'Word guess', note: 'Six tries, five letters, infinite replays', icon: 'spark' },
  { key: 'dominoes', label: 'Dominoes', note: 'Double-six against a patient bot', icon: 'game' },
  { key: 'blackjack', label: 'Blackjack', note: 'Dealer stands on 17 — chips are pretend', icon: 'game' },
  { key: 'poker', label: 'Five-card draw', note: 'You against three bots, one trade', icon: 'game' },
  { key: 'solitaire', label: 'Solitaire', note: 'Klondike, one card at a time', icon: 'game' },
  { key: 'tetris', label: 'Tetris', note: 'Arrow keys, lines, high score', icon: 'game' },
];

const ONLINE: { key: 'dominoes' | 'wordduel' | 'blackjack'; label: string; note: string; icon: IconName }[] = [
  { key: 'dominoes', label: 'Dominoes', note: 'Two players, block or go out', icon: 'game' },
  { key: 'wordduel', label: 'Word duel', note: 'Same word, race to solve it', icon: 'spark' },
  { key: 'blackjack', label: 'Blackjack table', note: 'Both play the same dealer hand', icon: 'game' },
];

const GAME_LABEL: Record<string, string> = { dominoes: 'Dominoes', wordduel: 'Word duel', blackjack: 'Blackjack' };

export default function GamesScreen() {
  const { toast, run } = useApp();
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [solo, setSolo] = useState<SoloKey | null>(null);
  const [tableId, setTableId] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<'public' | 'circle'>('public');

  async function load() {
    try {
      const res = await api<Lobby>('/games');
      setLobby(res);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not load the games lobby.', 'error');
    }
  }

  useEffect(() => {
    if (tableId || solo) return;
    void load();
    const t = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 7000);
    return () => window.clearInterval(t);
  }, [tableId, solo]);

  async function create(game: string) {
    try {
      const res = await api<{ table: GameTable }>('/games', { method: 'POST', body: { game, visibility } });
      setTableId(res.table.id);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not open a table.', 'error');
    }
  }

  async function join(id: string) {
    try {
      await api(`/games/${id}/join`, { method: 'POST' });
      setTableId(id);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not join that table.', 'error');
    }
  }

  if (tableId) return <TableView id={tableId} onExit={() => { setTableId(null); void load(); }} />;

  if (solo) {
    const component =
      solo === 'daily' ? <DailyWord /> :
      solo === 'word' ? <WordGuess /> :
      solo === 'dominoes' ? <DominoesSolo /> :
      solo === 'blackjack' ? <Blackjack /> :
      solo === 'poker' ? <Poker /> :
      solo === 'solitaire' ? <Solitaire /> :
      <Tetris />;
    const meta = SOLO.find((g) => g.key === solo);
    return (
      <div className="screen">
        <div className="back-row">
          <Button size="sm" variant="quiet" icon="back" onClick={() => setSolo(null)}>
            All games
          </Button>
          {meta ? <Pill tone="amber">{meta.label}</Pill> : null}
        </div>
        {component}
      </div>
    );
  }

  const open = lobby?.open || [];
  const mine = lobby?.mine || [];

  return (
    <div className="screen">
      <div className="section-head">
        <div>
          <h1 className="section-title">Games</h1>
          <p className="section-sub">
            Play alone or with someone in your circle. Nothing here costs money, and nothing is gambling.
          </p>
        </div>
      </div>

      <Card>
        <CardHead
          title="Today’s puzzle"
          hint={lobby?.daily ? `${lobby.daily.date} · ${lobby.daily.played ? 'finished' : 'not started'}` : 'One word a day'}
          icon="spark"
          action={
            <Button size="sm" variant="ghost" onClick={() => setSolo('daily')}>
              Play
            </Button>
          }
        />
        <p className="small" style={{ lineHeight: 1.6, color: '#c9d6db', margin: 0 }}>
          Everyone on Northlight gets the same five-letter word on the same day. Solve it in six, then copy
          your grid and compare with a friend.
        </p>
      </Card>

      <Card>
        <CardHead title="Play alone" hint="No account needed beyond yours. Progress stays on this device." icon="game" />
        <div className="game-grid">
          {SOLO.map((g) => (
            <button key={g.key} className="game-card" onClick={() => setSolo(g.key)}>
              <span className="hub-icon">
                <Icon name={g.icon} size={18} />
              </span>
              <b>{g.label}</b>
              <span>{g.note}</span>
              {g.key === 'daily' && lobby?.daily.played ? <span className="badge">played today</span> : null}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <CardHead
          title="Play each other"
          hint="Open a table and send someone to the Games screen. Both of you see the same board."
          icon="users"
          action={
            <Segmented
              small
              options={[
                { value: 'public', label: 'Anyone' },
                { value: 'circle', label: 'My circle' },
              ]}
              value={visibility}
              onChange={setVisibility}
            />
          }
        />
        <div className="game-grid">
          {ONLINE.map((g) => (
            <button key={g.key} className="game-card" onClick={() => void create(g.key)}>
              <span className="hub-icon">
                <Icon name={g.icon} size={18} />
              </span>
              <b>{g.label}</b>
              <span>{g.note}</span>
              <span className="badge">open a table</span>
            </button>
          ))}
        </div>

        <div className="divider" style={{ marginTop: 18 }}>
          open tables
        </div>
        {open.length === 0 ? (
          <p className="small muted">No open tables right now. Open one above and leave it up.</p>
        ) : (
          <div className="stack-tight">
            {open.map((t) => (
              <div key={t.id} className="list-item" style={{ alignItems: 'center' }}>
                <div className="grow">
                  <div className="list-title">
                    {GAME_LABEL[t.game]} · {t.players[0]?.name || 'Someone'}
                  </div>
                  <div className="list-note">
                    {t.visibility === 'circle' ? 'circle only' : 'open to anyone'} · {timeAgo(t.at)}
                  </div>
                </div>
                <Button size="sm" variant="primary" onClick={() => void join(t.id)}>
                  Join
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="divider" style={{ marginTop: 18 }}>
          your tables
        </div>
        {mine.length === 0 ? (
          <p className="small muted">You have not played yet.</p>
        ) : (
          <div className="stack-tight">
            {mine.map((t) => (
              <div key={t.id} className="list-item" style={{ alignItems: 'center' }}>
                <div className="grow">
                  <div className="list-title">
                    {GAME_LABEL[t.game]} · {t.status}
                  </div>
                  <div className="list-note">
                    {t.players.map((p) => p.name.split(' ')[0]).join(' vs ') || 'waiting'} ·{' '}
                    {t.result === 'won' ? 'you won' : t.result === 'lost' ? 'you lost' : t.result === 'draw' ? 'draw' : timeAgo(t.updatedAt)}
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setTableId(t.id)}>
                  {t.status === 'open' ? 'Wait' : t.status === 'playing' ? 'Resume' : 'View'}
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHead title="Fair play" hint="Every online move is checked by the server." icon="shield" />
        <p className="small muted" style={{ lineHeight: 1.6, margin: 0 }}>
          Dominoes hands are private — your opponent sees how many tiles you hold, never which ones. Word duel
          words are hidden until the round ends. Blackjack is dealt server-side. Solo games run on your device.
        </p>
      </Card>
    </div>
  );
}
