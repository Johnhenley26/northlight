import { useEffect, useMemo, useRef, useState } from 'react';
import { api, DailyState } from '../api';
import { useApp } from '../store';
import { Button, Card, CardHead, Icon, Pill, Progress } from '../ui';

/* --------------------------------- helpers -------------------------------- */

const WORDS = `ABOUT ALONE BRAVE BREAD CHAIR CLEAN CLOSE DREAM DRIVE EARLY EARTH FIELD FIGHT
FRESH GLASS GRACE GREEN HEART HOUSE LIGHT LOCAL MONEY MUSIC NIGHT OCEAN PEACE PLACE PLANT
QUICK QUIET RIVER ROUND SHARE SHARP SLEEP SMALL SMILE SOLID SOUND SPACE STONE STORY TABLE
THANK THEIR THING THINK THREE TODAY TOUCH TRACK TRUCK TRUST TRUTH WATER WHILE WHITE WORLD
WRITE YOUNG`.split(/\s+/).filter((w) => w.length === 5);

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function marksFor(guess: string, word: string) {
  const g = guess.toUpperCase().split('');
  const w = word.toUpperCase().split('');
  const marks = new Array(g.length).fill('absent') as string[];
  const pool: Record<string, number> = {};
  w.forEach((ch, i) => {
    if (g[i] !== ch) pool[ch] = (pool[ch] || 0) + 1;
  });
  g.forEach((ch, i) => {
    if (ch === w[i]) marks[i] = 'correct';
  });
  g.forEach((ch, i) => {
    if (marks[i] === 'correct') return;
    if (pool[ch] > 0) {
      marks[i] = 'present';
      pool[ch] -= 1;
    }
  });
  return marks;
}

function Row({ word, marks }: { word: string; marks: string[] }) {
  return (
    <div className="word-row">
      {word.split('').map((ch, i) => (
        <span key={i} className={`letter ${marks[i] || ''}`}>
          {ch}
        </span>
      ))}
    </div>
  );
}

/* ------------------------------- daily word ------------------------------- */

export function DailyWord() {
  const { toast } = useApp();
  const [state, setState] = useState<DailyState | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api<DailyState>('/games/daily').then(setState).catch(() => setState(null));
  }, []);

  async function guess() {
    const word = draft.trim().toUpperCase();
    if (!/^[A-Z]{5}$/.test(word)) {
      toast('Five letters, A to Z.', 'error');
      return;
    }
    setBusy(true);
    try {
      const next = await api<DailyState>('/games/daily/guess', { method: 'POST', body: { guess: word } });
      setState(next);
      setDraft('');
      if (next.solved) toast(`Solved in ${next.guesses.length}. Same word for everybody.`, 'ok');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That guess did not go through.', 'error');
    } finally {
      setBusy(false);
    }
  }

  function share() {
    if (!state) return;
    const grid = state.guesses
      .map((g) => g.marks.map((m) => (m === 'correct' ? '🟩' : m === 'present' ? '🟨' : '⬜')).join(''))
      .join('\n');
    const text = `Northlight daily word ${state.date}\n${grid}\n${state.solved ? state.guesses.length : 'X'}/6`;
    void navigator.clipboard.writeText(text).then(
      () => toast('Result copied — paste it anywhere.', 'ok'),
      () => toast(text, 'info')
    );
  }

  return (
    <Card>
      <CardHead
        title="Daily word"
        hint="The same five-letter word for everyone, everywhere. One puzzle a day."
        icon="spark"
        action={state ? <Pill tone="mint">{state.attemptsLeft} left</Pill> : null}
      />
      {!state ? (
        <p className="small muted">Loading today’s word…</p>
      ) : (
        <>
          <div className="word-rows">
            {state.guesses.map((g, i) => (
              <Row key={i} word={g.word} marks={g.marks} />
            ))}
            {Array.from({ length: Math.max(0, 1) }).map((_, i) =>
              !state.done && state.guesses.length < 6 ? (
                <div className="word-row" key={`next-${i}`}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <span key={j} className="letter">
                      {draft[j] || ''}
                    </span>
                  ))}
                </div>
              ) : null
            )}
          </div>

          {state.done ? (
            <div className="note-box">
              <b>{state.solved ? `Solved in ${state.guesses.length}.` : 'Not today.'}</b> The word was{' '}
              <b>{state.answer}</b>. A new word lands at midnight.
              <div style={{ marginTop: 10 }}>
                <Button size="sm" variant="ghost" icon="share" onClick={share}>
                  Copy result
                </Button>
              </div>
            </div>
          ) : (
            <form
              className="row"
              onSubmit={(e) => {
                e.preventDefault();
                void guess();
              }}
            >
              <input
                className="input grow"
                value={draft}
                onChange={(e) => setDraft(e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 5).toUpperCase())}
                placeholder="Five letters"
                aria-label="Daily guess"
                maxLength={5}
                autoCapitalize="characters"
              />
              <Button type="submit" disabled={busy || draft.length !== 5}>
                Guess
              </Button>
            </form>
          )}
        </>
      )}
    </Card>
  );
}

/* ------------------------------- word guess ------------------------------- */

export function WordGuess() {
  const [answer, setAnswer] = useState(() => WORDS[Math.floor(Math.random() * WORDS.length)]);
  const [guesses, setGuesses] = useState<{ word: string; marks: string[] }[]>([]);
  const [draft, setDraft] = useState('');
  const done = guesses.some((g) => g.word === answer) || guesses.length >= 6;

  function submit() {
    if (!/^[A-Z]{5}$/.test(draft) || done) return;
    const word = draft.toUpperCase();
    setGuesses((g) => [...g, { word, marks: marksFor(word, answer) }]);
    setDraft('');
  }

  function reset() {
    setAnswer(WORDS[Math.floor(Math.random() * WORDS.length)]);
    setGuesses([]);
    setDraft('');
  }

  return (
    <Card>
      <CardHead title="Word guess" hint="Six tries at a five-letter word. Green is the right letter in the right place." icon="spark" />
      <div className="word-rows">
        {guesses.map((g, i) => (
          <Row key={i} word={g.word} marks={g.marks} />
        ))}
        {!done ? (
          <div className="word-row">
            {Array.from({ length: 5 }).map((_, j) => (
              <span key={j} className="letter">
                {draft[j] || ''}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {done ? (
        <div className="note-box">
          <b>{guesses.some((g) => g.word === answer) ? 'Got it.' : `The word was ${answer}.`}</b> Another word?
          <div style={{ marginTop: 10 }}>
            <Button size="sm" onClick={reset}>
              Play again
            </Button>
          </div>
        </div>
      ) : (
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <input
            className="input grow"
            value={draft}
            onChange={(e) => setDraft(e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 5).toUpperCase())}
            placeholder="Five letters"
            aria-label="Your guess"
            maxLength={5}
          />
          <Button type="submit" disabled={draft.length !== 5}>
            Guess
          </Button>
        </form>
      )}
    </Card>
  );
}

/* -------------------------------- blackjack ------------------------------- */

type BCard = { r: number; s: number };

function freshDeck(): BCard[] {
  const deck: BCard[] = [];
  for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) deck.push({ r, s });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

const cardValue = (c: BCard) => (c.r === 1 ? 11 : c.r > 10 ? 10 : c.r);

function handTotal(cards: BCard[]) {
  let total = cards.reduce((n, c) => n + cardValue(c), 0);
  let aces = cards.filter((c) => c.r === 1).length;
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return total;
}

function PlayingCard({ card, hidden }: { card?: BCard; hidden?: boolean }) {
  if (hidden || !card) return <div className="playing-card is-back" aria-label="Face-down card" />;
  const red = card.s === 1 || card.s === 2;
  return (
    <div className={`playing-card ${red ? 'is-red' : ''}`} aria-label={`${RANKS[card.r - 1]}${SUITS[card.s]}`}>
      {RANKS[card.r - 1]}
      {SUITS[card.s]}
    </div>
  );
}

export function Blackjack() {
  const [deck, setDeck] = useState<BCard[]>([]);
  const [player, setPlayer] = useState<BCard[]>([]);
  const [dealer, setDealer] = useState<BCard[]>([]);
  const [phase, setPhase] = useState<'idle' | 'player' | 'dealer' | 'done'>('idle');
  const [chips, setChips] = useState(100);
  const [message, setMessage] = useState('');
  const [bet, setBet] = useState(10);

  function deal() {
    if (chips < bet) {
      setMessage('Not enough chips for that bet. Lower it or reset.');
      return;
    }
    const d = freshDeck();
    const p = [d.pop()!, d.pop()!];
    const dl = [d.pop()!, d.pop()!];
    setDeck(d);
    setPlayer(p);
    setDealer(dl);
    setChips((c) => c - bet);
    setMessage('');
    if (handTotal(p) === 21) {
      setPhase('done');
      setMessage(handTotal(dl) === 21 ? 'Both blackjack — push.' : 'Blackjack. Paid 3:2.');
      if (handTotal(dl) !== 21) setChips((c) => c + Math.round(bet * 2.5));
      return;
    }
    setPhase('player');
  }

  function hit() {
    if (phase !== 'player') return;
    const d = deck.slice();
    const card = d.pop();
    if (!card) return;
    const next = [...player, card];
    setDeck(d);
    setPlayer(next);
    if (handTotal(next) > 21) {
      setPhase('done');
      setMessage('Bust.');
    }
  }

  function stand() {
    if (phase !== 'player') return;
    setPhase('dealer');
    const d = deck.slice();
    const dl = [...dealer];
    while (handTotal(dl) < 17) {
      const card = d.pop();
      if (!card) break;
      dl.push(card);
    }
    setDeck(d);
    setDealer(dl);
    const p = handTotal(player);
    const dv = handTotal(dl);
    if (dv > 21) {
      setChips((c) => c + bet * 2);
      setMessage(`Dealer busts with ${dv}. You win $${bet}.`);
    } else if (p > dv) {
      setChips((c) => c + bet * 2);
      setMessage(`You ${p}, dealer ${dv}. You win $${bet}.`);
    } else if (p === dv) {
      setChips((c) => c + bet);
      setMessage(`Both ${p}. Push — bet back.`);
    } else {
      setMessage(`You ${p}, dealer ${dv}. Dealer wins.`);
    }
    setPhase('done');
  }

  function double() {
    if (phase !== 'player' || chips < bet) return;
    setChips((c) => c - bet);
    setBet((b) => b * 2);
    const d = deck.slice();
    const card = d.pop();
    if (!card) return;
    const next = [...player, card];
    setDeck(d);
    setPlayer(next);
    const p = handTotal(next);
    const dl = [...dealer];
    while (handTotal(dl) < 17) {
      const c = d.pop();
      if (!c) break;
      dl.push(c);
    }
    setDealer(dl);
    const dv = handTotal(dl);
    if (p > 21) setMessage('Bust on the double.');
    else if (dv > 21 || p > dv) {
      setChips((c) => c + bet * 2);
      setMessage(`Double pays. You ${p}, dealer ${dv}.`);
    } else if (p === dv) {
      setChips((c) => c + bet);
      setMessage('Push.');
    } else setMessage(`Dealer ${dv} beats ${p}.`);
    setPhase('done');
    setTimeout(() => setBet((b) => Math.max(5, b / 2)), 50);
  }

  return (
    <Card>
      <CardHead
        title="Blackjack"
        hint="Dealer stands on 17. Blackjack pays 3:2. No real money, ever."
        icon="game"
        action={<Pill tone="amber">${chips} chips</Pill>}
      />
      <div className="game-stage">
        <div>
          <div className="tiny muted" style={{ marginBottom: 6 }}>
            Dealer {phase === 'player' ? handTotal([dealer[0]].filter(Boolean) as BCard[]) : handTotal(dealer)}
          </div>
          <div className="hand">
            {dealer.length ? (
              dealer.map((c, i) => <PlayingCard key={i} card={c} hidden={phase === 'player' && i === 1} />)
            ) : (
              <span className="small muted">No cards dealt.</span>
            )}
          </div>
        </div>
        <div>
          <div className="tiny muted" style={{ marginBottom: 6 }}>
            You {handTotal(player)}
          </div>
          <div className="hand">
            {player.length ? player.map((c, i) => <PlayingCard key={i} card={c} />) : <span className="small muted">Press deal.</span>}
          </div>
        </div>
        {message ? <div className="note-box">{message}</div> : null}
        <div className="row wrap">
          {phase === 'idle' || phase === 'done' ? (
            <>
              <Button onClick={deal} icon="play">
                Deal ${bet}
              </Button>
              <div className="row" style={{ gap: 4 }}>
                {[5, 10, 25].map((v) => (
                  <button key={v} className={`chip ${bet === v ? 'is-active' : ''}`} onClick={() => setBet(v)}>
                    ${v}
                  </button>
                ))}
              </div>
              {chips === 0 ? (
                <Button variant="quiet" onClick={() => setChips(100)}>
                  Reset chips
                </Button>
              ) : null}
            </>
          ) : (
            <>
              <Button variant="primary" onClick={hit}>
                Hit
              </Button>
              <Button variant="ghost" onClick={stand}>
                Stand
              </Button>
              {player.length === 2 && chips >= bet ? (
                <Button variant="quiet" onClick={double}>
                  Double
                </Button>
              ) : null}
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

/* ---------------------------------- poker --------------------------------- */

type PHand = { cat: number; tie: number[]; name: string };

function evaluate(cards: BCard[]): PHand {
  const ranks = cards.map((c) => c.r).sort((a, b) => b - a);
  const counts = new Map<number, number>();
  ranks.forEach((r) => counts.set(r, (counts.get(r) || 0) + 1));
  const flush = cards.every((c) => c.s === cards[0].s);
  const uniq = [...new Set(ranks)].sort((a, b) => b - a);
  const wheel = uniq.length === 5 && uniq[0] === 14 && uniq[1] === 5;
  const straight = uniq.length === 5 && (uniq[0] - uniq[4] === 4 || wheel);
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const kickers = groups.flatMap(([r, n]) => Array(n).fill(r) as number[]);
  const high = wheel ? 5 : uniq[0];
  if (straight && flush) return { cat: 8, tie: [high], name: 'Straight flush' };
  if (groups[0][1] === 4) return { cat: 7, tie: [groups[0][0], groups[1][0]], name: 'Four of a kind' };
  if (groups[0][1] === 3 && groups[1][1] === 2) return { cat: 6, tie: [groups[0][0], groups[1][0]], name: 'Full house' };
  if (flush) return { cat: 5, tie: ranks, name: 'Flush' };
  if (straight) return { cat: 4, tie: [high], name: 'Straight' };
  if (groups[0][1] === 3) return { cat: 3, tie: kickers, name: 'Three of a kind' };
  if (groups[0][1] === 2 && groups[1][1] === 2)
    return { cat: 2, tie: [groups[0][0], groups[1][0], groups[2][0]], name: 'Two pair' };
  if (groups[0][1] === 2) return { cat: 1, tie: kickers, name: 'Pair' };
  return { cat: 0, tie: ranks, name: 'High card' };
}

const compareHands = (a: PHand, b: PHand) => {
  if (a.cat !== b.cat) return a.cat - b.cat;
  for (let i = 0; i < Math.max(a.tie.length, b.tie.length); i++) {
    const d = (a.tie[i] || 0) - (b.tie[i] || 0);
    if (d) return d;
  }
  return 0;
};

export function Poker() {
  const [deck, setDeck] = useState<BCard[]>([]);
  const [hand, setHand] = useState<BCard[]>([]);
  const [bots, setBots] = useState<BCard[][]>([[], [], []]);
  const [selected, setSelected] = useState<number[]>([]);
  const [phase, setPhase] = useState<'idle' | 'draw' | 'done'>('idle');
  const [chips, setChips] = useState(100);
  const [message, setMessage] = useState('');
  const [revealed, setRevealed] = useState<BCard[][]>([[], [], []]);

  function deal() {
    if (chips < 10) {
      setMessage('Out of chips. Reset to play again.');
      return;
    }
    const d = freshDeck();
    setDeck(d);
    setHand([d.pop()!, d.pop()!, d.pop()!, d.pop()!, d.pop()!]);
    setBots([
      [d.pop()!, d.pop()!, d.pop()!, d.pop()!, d.pop()!],
      [d.pop()!, d.pop()!, d.pop()!, d.pop()!, d.pop()!],
      [d.pop()!, d.pop()!, d.pop()!, d.pop()!, d.pop()!],
    ]);
    setSelected([]);
    setRevealed([[], [], []]);
    setPhase('draw');
    setChips((c) => c - 10);
    setMessage('Pick up to three cards to trade in.');
  }

  function draw() {
    const d = deck.slice();
    const next = hand.map((c, i) => (selected.includes(i) ? d.pop()! : c));
    const nextBots = bots.map((b) => {
      // Bots keep pairs and anything 10 or higher, trade the rest (max 3).
      const keep = b.filter((c) => c.r >= 10 || b.filter((x) => x.r === c.r).length > 1);
      const trade = b.map((c, i) => (keep.includes(c) ? -1 : i)).filter((i) => i >= 0).slice(0, 3);
      return b.map((c, i) => (trade.includes(i) ? d.pop()! : c));
    });
    const mine = evaluate(next);
    const theirs = nextBots.map(evaluate);
    setHand(next);
    setBots(nextBots);
    setRevealed(nextBots);
    setDeck(d);
    setPhase('done');

    const bestBot = theirs.reduce((best, h) => (compareHands(h, best) > 0 ? h : best), theirs[0]);
    const vsBest = compareHands(mine, bestBot);
    if (vsBest > 0) {
      setChips((c) => c + 30);
      setMessage(`${mine.name} beats the table. +$30.`);
    } else if (vsBest === 0 && theirs.filter((h) => compareHands(h, mine) === 0).length === 1) {
      setChips((c) => c + 10);
      setMessage(`${mine.name} ties the best bot. Bet back.`);
    } else {
      setMessage(`${mine.name} — the table had better. -$10.`);
    }
  }

  return (
    <Card>
      <CardHead
        title="Poker — five-card draw"
        hint="You against three bots. Keep what is good, trade up to three."
        icon="game"
        action={<Pill tone="amber">${chips} chips</Pill>}
      />
      <div className="game-stage">
        <div>
          <div className="tiny muted" style={{ marginBottom: 6 }}>
            Your hand{hand.length ? ` · ${evaluate(hand).name}` : ''}
          </div>
          <div className="hand">
            {hand.length === 0 ? (
              <span className="small muted">Press deal — $10 a hand.</span>
            ) : (
              hand.map((c, i) => (
                <button
                  key={i}
                  className="playing-card"
                  style={{
                    borderColor: selected.includes(i) ? '#f0a04b' : undefined,
                    transform: selected.includes(i) ? 'translateY(-6px)' : undefined,
                    color: c.s === 1 || c.s === 2 ? '#b23b34' : '#1d1a15',
                  }}
                  onClick={() =>
                    phase === 'draw'
                      ? setSelected((s) => (s.includes(i) ? s.filter((x) => x !== i) : s.length < 3 ? [...s, i] : s))
                      : undefined
                  }
                  disabled={phase !== 'draw'}
                  aria-pressed={selected.includes(i)}
                >
                  {RANKS[c.r - 1]}
                  {SUITS[c.s]}
                </button>
              ))
            )}
          </div>
        </div>

        {revealed[0]?.length ? (
          <div>
            <div className="tiny muted" style={{ marginBottom: 6 }}>
              The table
            </div>
            <div className="stack-tight">
              {revealed.map((b, i) => (
                <div key={i} className="row" style={{ gap: 8, alignItems: 'center' }}>
                  <span className="tiny muted" style={{ width: 54 }}>
                    Bot {i + 1}
                  </span>
                  <div className="hand">
                    {b.map((c, j) => (
                      <PlayingCard key={j} card={c} />
                    ))}
                  </div>
                  <Pill>{evaluate(b).name}</Pill>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {message ? <div className="note-box">{message}</div> : null}

        <div className="row wrap">
          {phase === 'idle' || phase === 'done' ? (
            <>
              <Button icon="play" onClick={deal}>
                Deal $10
              </Button>
              {chips === 0 ? (
                <Button variant="quiet" onClick={() => setChips(100)}>
                  Reset chips
                </Button>
              ) : null}
            </>
          ) : (
            <Button onClick={draw} disabled={selected.length === 0}>
              Trade {selected.length || 0} and show
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

/* -------------------------------- solitaire ------------------------------- */

type SCard = { r: number; s: number; up: boolean };
type Sel = { pile: 'waste' | 'tableau' | 'foundation'; col: number; idx: number } | null;

const isRed = (s: number) => s === 1 || s === 2;

function solDeal() {
  const deck: SCard[] = [];
  for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) deck.push({ r, s, up: false });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const tableau: SCard[][] = [[], [], [], [], [], [], []];
  for (let col = 0; col < 7; col++) {
    for (let row = 0; row <= col; row++) {
      const card = deck.pop()!;
      card.up = row === col;
      tableau[col].push(card);
    }
  }
  return {
    stock: deck.map((c) => ({ ...c, up: false })),
    waste: [] as SCard[],
    foundations: [0, 1, 2, 3].map(() => ({ suit: null as number | null, cards: [] as SCard[] })),
    tableau,
  };
}

export function Solitaire() {
  const [game, setGame] = useState(solDeal);
  const [sel, setSel] = useState<Sel>(null);
  const [moves, setMoves] = useState(0);
  const won = game.foundations.reduce((n, f) => n + f.cards.length, 0) === 52;

  function newGame() {
    setGame(solDeal());
    setSel(null);
    setMoves(0);
  }

  function drawFromStock() {
    setGame((g) => {
      if (g.stock.length === 0) {
        if (g.waste.length === 0) return g;
        return { ...g, stock: g.waste.slice().reverse().map((c) => ({ ...c, up: false })), waste: [] };
      }
      const stock = g.stock.slice();
      const card = stock.pop()!;
      return { ...g, stock, waste: [...g.waste, { ...card, up: true }] };
    });
    setSel(null);
    setMoves((m) => m + 1);
  }

  function pick(pile: Sel extends null ? never : 'waste' | 'tableau' | 'foundation', col: number, idx: number) {
    const card =
      pile === 'waste'
        ? game.waste[game.waste.length - 1]
        : pile === 'foundation'
        ? game.foundations[col].cards[game.foundations[col].cards.length - 1]
        : game.tableau[col][idx];
    if (!card || !card.up) return;
    setSel({ pile, col, idx });
  }

  function toFoundation(col: number) {
    if (!sel) return;
    const f = game.foundations[col];
    const card =
      sel.pile === 'waste'
        ? game.waste[game.waste.length - 1]
        : sel.pile === 'tableau'
        ? game.tableau[sel.col][sel.idx]
        : null;
    if (!card) {
      setSel(null);
      return;
    }
    if (sel.pile === 'tableau' && sel.idx !== game.tableau[sel.col].length - 1) return;
    const ok = f.suit === null ? card.r === 1 : f.suit === card.s && card.r === f.cards.length + 1;
    if (!ok) return;
    setGame((g) => {
      const next = { ...g, foundations: g.foundations.map((x) => ({ ...x, cards: x.cards.slice() })), waste: g.waste.slice(), tableau: g.tableau.map((t) => t.slice()) };
      if (sel.pile === 'waste') next.waste.pop();
      else next.tableau[sel.col].pop();
      const target = next.foundations[col];
      target.suit = card.s;
      target.cards.push({ ...card, up: true });
      if (sel.pile === 'tableau') {
        const pile = next.tableau[sel.col];
        if (pile.length && !pile[pile.length - 1].up) pile[pile.length - 1] = { ...pile[pile.length - 1], up: true };
      }
      return next;
    });
    setSel(null);
    setMoves((m) => m + 1);
  }

  function toTableau(col: number) {
    if (!sel) return;
    const target = game.tableau[col];
    const top = target[target.length - 1];
    let moving: SCard[] = [];
    if (sel.pile === 'waste') moving = [game.waste[game.waste.length - 1]];
    else if (sel.pile === 'tableau') moving = game.tableau[sel.col].slice(sel.idx);
    else return;
    if (!moving.length || !moving[0]) return;
    const ok = !top ? moving[0].r === 13 : top.up && isRed(top.s) !== isRed(moving[0].s) && top.r === moving[0].r + 1;
    if (!ok) return;
    setGame((g) => {
      const next = { ...g, waste: g.waste.slice(), tableau: g.tableau.map((t) => t.slice()) };
      if (sel.pile === 'waste') next.waste.pop();
      else {
        next.tableau[sel.col] = next.tableau[sel.col].slice(0, sel.idx);
        const src = next.tableau[sel.col];
        if (src.length && !src[src.length - 1].up) src[src.length - 1] = { ...src[src.length - 1], up: true };
      }
      next.tableau[col].push(...moving.map((c) => ({ ...c, up: true })));
      return next;
    });
    setSel(null);
    setMoves((m) => m + 1);
  }

  return (
    <Card>
      <CardHead
        title="Solitaire"
        hint="Klondike, one card at a time. Tap a card, then tap where it should go."
        icon="game"
        action={
          <div className="row" style={{ gap: 6 }}>
            <Pill>{moves} moves</Pill>
            <Button size="sm" variant="quiet" onClick={newGame}>
              New deal
            </Button>
          </div>
        }
      />
      {won ? <div className="note-box"><b>You finished it.</b> All 52 home. New deal?</div> : null}
      <div className="solitaire">
        <div className="sol-top">
          <div className="sol-pile">
            <button className="sol-card is-empty" onClick={drawFromStock} aria-label="Draw from stock">
              {game.stock.length || '↺'}
            </button>
          </div>
          <div className="sol-pile">
            {game.waste.length ? (
              <button
                className={`sol-card ${isRed(game.waste[game.waste.length - 1].s) ? 'is-red' : ''} ${
                  sel?.pile === 'waste' ? 'is-selected' : ''
                }`}
                onClick={() => pick('waste', 0, 0)}
              >
                {RANKS[game.waste[game.waste.length - 1].r - 1]}
                {SUITS[game.waste[game.waste.length - 1].s]}
              </button>
            ) : (
              <div className="sol-card is-empty" aria-hidden="true" />
            )}
          </div>
          <div style={{ width: 12 }} />
          {game.foundations.map((f, i) => (
            <div key={i} className="sol-pile">
              <button
                className="sol-card is-empty"
                onClick={() => toFoundation(i)}
                aria-label={`Foundation ${i + 1}`}
              >
                {f.cards.length ? `${RANKS[f.cards.length - 1]}${SUITS[f.suit ?? 0]}` : 'A'}
              </button>
            </div>
          ))}
        </div>

        <div className="sol-tableau">
          {game.tableau.map((col, ci) => (
            <div key={ci} className="sol-col" onClick={() => toTableau(ci)}>
              {col.length === 0 ? <div className="sol-card is-empty">K</div> : null}
              {col.map((card, i) => (
                <button
                  key={`${card.r}-${card.s}`}
                  className={`sol-card ${isRed(card.s) ? 'is-red' : ''} ${
                    sel?.pile === 'tableau' && sel.col === ci && sel.idx === i ? 'is-selected' : ''
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!card.up) {
                      setGame((g) => {
                        const t = g.tableau.map((x) => x.slice());
                        if (i === t[ci].length - 1) t[ci][i] = { ...t[ci][i], up: true };
                        return { ...g, tableau: t };
                      });
                      return;
                    }
                    pick('tableau', ci, i);
                  }}
                  style={{ marginLeft: i * 2, zIndex: i }}
                >
                  {card.up ? `${RANKS[card.r - 1]}${SUITS[card.s]}` : '•'}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
      <p className="field-hint" style={{ marginTop: 10 }}>
        Tap the deck to draw. Tap any face-up card to pick it up, then tap a column or an ace pile to place it.
      </p>
    </Card>
  );
}

/* ---------------------------------- tetris -------------------------------- */

const SHAPES: number[][][] = [
  [[1, 1, 1, 1]],
  [
    [1, 1],
    [1, 1],
  ],
  [
    [0, 1, 0],
    [1, 1, 1],
  ],
  [
    [1, 0, 0],
    [1, 1, 1],
  ],
  [
    [0, 0, 1],
    [1, 1, 1],
  ],
  [
    [1, 1, 0],
    [0, 1, 1],
  ],
  [
    [0, 1, 1],
    [1, 1, 0],
  ],
];

const emptyGrid = () => Array.from({ length: 20 }, () => Array(10).fill(0) as number[]);

function rotate(shape: number[][]) {
  return shape[0].map((_, i) => shape.map((row) => row[i]).reverse());
}

type TState = {
  grid: number[][];
  shape: number[][];
  x: number;
  y: number;
  next: number;
  score: number;
  lines: number;
  over: boolean;
  paused: boolean;
};

function spawn(grid: number[][], next: number): TState {
  return {
    grid,
    shape: SHAPES[next],
    x: Math.floor((10 - SHAPES[next][0].length) / 2),
    y: 0,
    next: Math.floor(Math.random() * SHAPES.length),
    score: 0,
    lines: 0,
    over: false,
    paused: false,
  };
}

function merge(grid: number[][], shape: number[][], x: number, y: number) {
  const g = grid.map((r) => r.slice());
  shape.forEach((row, ry) =>
    row.forEach((v, rx) => {
      if (!v) return;
      const gy = y + ry;
      const gx = x + rx;
      if (gy >= 0 && gy < 20 && gx >= 0 && gx < 10) g[gy][gx] = 1;
    })
  );
  return g;
}

function collides(grid: number[][], shape: number[][], x: number, y: number) {
  for (let ry = 0; ry < shape.length; ry++) {
    for (let rx = 0; rx < shape[ry].length; rx++) {
      if (!shape[ry][rx]) continue;
      const gy = y + ry;
      const gx = x + rx;
      if (gx < 0 || gx >= 10 || gy >= 20) return true;
      if (gy >= 0 && grid[gy][gx]) return true;
    }
  }
  return false;
}

export function Tetris() {
  const { toast } = useApp();
  const [st, setSt] = useState<TState>(() => spawn(emptyGrid(), Math.floor(Math.random() * 7)));
  const reported = useRef(false);

  const seat = (state: TState) => {
    const merged = merge(state.grid, state.shape, state.x, state.y);
    const kept = merged.filter((row) => row.some((v) => !v));
    const cleared = 20 - kept.length;
    const grid = [...Array.from({ length: cleared }, () => Array(10).fill(0) as number[]), ...kept];
    const base = spawn(grid, state.next);
    const blocked = collides(grid, base.shape, base.x, base.y);
    return {
      ...base,
      score: state.score + [0, 100, 300, 500, 800][cleared],
      lines: state.lines + cleared,
      over: blocked,
    };
  };

  const tick = () => {
    setSt((s) => {
      if (s.over || s.paused) return s;
      if (!collides(s.grid, s.shape, s.x, s.y + 1)) return { ...s, y: s.y + 1 };
      return seat(s);
    });
  };

  useEffect(() => {
    if (st.over) return;
    const t = window.setInterval(tick, 520);
    return () => window.clearInterval(t);
  }, [st.over, st.paused]);

  useEffect(() => {
    if (!st.over || reported.current) return;
    reported.current = true;
    void api('/games/solo', { method: 'POST', body: { game: 'tetris', score: st.score } })
      .then(() => toast(`Score sent: ${st.score}.`, 'ok'))
      .catch(() => undefined);
  }, [st.over, st.score, toast]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', ' '].includes(e.key)) e.preventDefault();
      setSt((s) => {
        if (s.over) return s;
        if (e.key === 'ArrowLeft' && !collides(s.grid, s.shape, s.x - 1, s.y)) return { ...s, x: s.x - 1 };
        if (e.key === 'ArrowRight' && !collides(s.grid, s.shape, s.x + 1, s.y)) return { ...s, x: s.x + 1 };
        if (e.key === 'ArrowDown') {
          if (!collides(s.grid, s.shape, s.x, s.y + 1)) return { ...s, y: s.y + 1 };
          return seat(s);
        }
        if (e.key === 'ArrowUp') {
          const rot = rotate(s.shape);
          return collides(s.grid, rot, s.x, s.y) ? s : { ...s, shape: rot };
        }
        if (e.key === ' ') {
          let y = s.y;
          while (!collides(s.grid, s.shape, s.x, y + 1)) y += 1;
          return seat({ ...s, y });
        }
        return s;
      });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const preview = useMemo(() => {
    const grid = merge(st.grid, st.shape, st.x, st.y);
    return grid;
  }, [st]);

  function reset() {
    reported.current = false;
    setSt(spawn(emptyGrid(), Math.floor(Math.random() * 7)));
  }

  return (
    <Card>
      <CardHead
        title="Tetris"
        hint="Arrow keys or the buttons. Space drops it. Scores go to the Northlight board."
        icon="game"
        action={<Pill tone="amber">{st.score} pts</Pill>}
      />
      <div className="tetris-wrap">
        <div className="tetris-board" aria-label="Tetris board">
          {preview.flatMap((row, y) =>
            row.map((v, x) => <div key={`${y}-${x}`} className={`tetris-cell ${v ? 'on' : ''}`} />)
          )}
        </div>
        <div className="stack-tight">
          <div className="tiny muted">Next</div>
          <div className="tetris-next">
            {SHAPES[st.next].flatMap((row, y) =>
              row.map((v, x) => (
                <div key={`${y}-${x}`} className={`tetris-cell ${v ? 'on' : ''}`} style={{ width: 16, height: 16 }} />
              ))
            )}
          </div>
          <Pill>{st.lines} lines</Pill>
          <div className="row wrap" style={{ gap: 6 }}>
            <Button size="sm" variant="quiet" onClick={() => setSt((s) => ({ ...s, x: Math.max(0, s.x - 1) }))}>
              ←
            </Button>
            <Button size="sm" variant="quiet" onClick={() => setSt((s) => ({ ...s, x: Math.min(9, s.x + 1) }))}>
              →
            </Button>
            <Button size="sm" variant="quiet" onClick={tick}>
              ↓
            </Button>
            <Button
              size="sm"
              variant="quiet"
              onClick={() => setSt((s) => ({ ...s, shape: rotate(s.shape) }))}
            >
              ⟳
            </Button>
          </div>
          {st.over ? (
            <div className="note-box">
              <b>Game over.</b> {st.score} points, {st.lines} lines.
              <div style={{ marginTop: 8 }}>
                <Button size="sm" onClick={reset}>
                  Play again
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------ dominoes solo ----------------------------- */

type DTile = [number, number];

const tileLabel = (t: DTile) => `${t[0]}–${t[1]}`;

function dealDominoes() {
  const tiles: DTile[] = [];
  for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) tiles.push([a, b]);
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }
  return { me: tiles.splice(0, 7), bot: tiles.splice(0, 7), boneyard: tiles, board: [] as { a: number; b: number }[], turn: 'me' as 'me' | 'bot', over: false, log: 'Your turn. Play a tile that matches either end.' };
}

export function DominoesSolo() {
  const [g, setG] = useState(dealDominoes);

  const playable = (hand: DTile[]) => {
    if (!g.board.length) return hand;
    const left = g.board[0].a;
    const right = g.board[g.board.length - 1].b;
    return hand.filter((t) => t[0] === left || t[1] === left || t[0] === right || t[1] === right);
  };

  function play(tile: DTile, who: 'me' | 'bot') {
    setG((state) => {
      const hand = who === 'me' ? state.me.slice() : state.bot.slice();
      const idx = hand.findIndex((t) => t[0] === tile[0] && t[1] === tile[1]);
      if (idx < 0) return state;
      const [a, b] = hand[idx];
      const board = state.board.slice();
      if (!board.length) board.push({ a, b });
      else {
        const left = board[0].a;
        const right = board[board.length - 1].b;
        if (b === left) board.unshift({ a, b });
        else if (a === left) board.unshift({ a: b, b: a });
        else if (a === right) board.push({ a, b });
        else board.push({ a: b, b: a });
      }
      hand.splice(idx, 1);
      const nextHand = who === 'me' ? hand : state.bot;
      const otherHand = who === 'me' ? state.bot : state.me;
      void nextHand;
      const empty = hand.length === 0;
      return {
        ...state,
        me: who === 'me' ? hand : state.me,
        bot: who === 'bot' ? hand : state.bot,
        board,
        turn: empty ? state.turn : who === 'me' ? 'bot' : 'me',
        over: empty,
        log: empty
          ? who === 'me'
            ? 'You went out. Domino!'
            : 'The bot went out. Deal again?'
          : `${who === 'me' ? 'You played' : 'Bot played'} ${tileLabel(tile)}. ${who === 'me' ? 'Bot’s turn.' : 'Your turn.'}`,
      };
    });
  }

  useEffect(() => {
    if (g.turn !== 'bot' || g.over) return;
    const t = window.setTimeout(() => {
      setG((state) => {
        if (state.turn !== 'bot' || state.over) return state;
        const options = playable(state.bot);
        if (options.length) {
          const tile = options[0];
          const hand = state.bot.slice();
          hand.splice(hand.findIndex((x) => x[0] === tile[0] && x[1] === tile[1]), 1);
          const board = state.board.slice();
          if (!board.length) board.push({ a: tile[0], b: tile[1] });
          else {
            const left = board[0].a;
            const right = board[board.length - 1].b;
            if (tile[1] === left) board.unshift({ a: tile[0], b: tile[1] });
            else if (tile[0] === left) board.unshift({ a: tile[1], b: tile[0] });
            else if (tile[0] === right) board.push({ a: tile[0], b: tile[1] });
            else board.push({ a: tile[1], b: tile[0] });
          }
          return {
            ...state,
            bot: hand,
            board,
            over: hand.length === 0,
            turn: hand.length === 0 ? state.turn : 'me',
            log: hand.length === 0 ? 'The bot went out. Deal again?' : `Bot played ${tileLabel(tile)}. Your turn.`,
          };
        }
        if (state.boneyard.length) {
          const boneyard = state.boneyard.slice();
          const drawn = boneyard.pop()!;
          return {
            ...state,
            bot: [...state.bot, drawn],
            boneyard,
            log: `Bot drew a tile. ${playable([...state.bot, drawn]).length ? 'Your turn.' : 'Bot passes.'}`,
          };
        }
        return { ...state, turn: 'me', log: 'Bot passes. Your turn.' };
      });
    }, 700);
    return () => window.clearTimeout(t);
  }, [g.turn, g.over, g.bot, g.board, g.boneyard]);

  const myPlayable = playable(g.me);

  return (
    <Card>
      <CardHead
        title="Dominoes"
        hint="Double-six, seven tiles each. Block the bot or go out first."
        icon="game"
        action={
          <Button size="sm" variant="quiet" onClick={() => setG(dealDominoes())}>
            New deal
          </Button>
        }
      />
      <div className="game-stage">
        <div className="board-chain">
          {g.board.length === 0 ? (
            <span className="small muted">The board is empty. Play anything.</span>
          ) : (
            g.board.map((t, i) => (
              <span key={i} className="domino">
                <span>{t.a}</span>
                <span>{t.b}</span>
              </span>
            ))
          )}
        </div>
        <div className="row-between">
          <span className="tiny muted">Bot: {g.bot.length} tiles · boneyard {g.boneyard.length}</span>
          <Pill tone={g.turn === 'me' ? 'mint' : 'neutral'}>{g.turn === 'me' ? 'your turn' : 'bot thinking'}</Pill>
        </div>
        <div>
          <div className="tiny muted" style={{ marginBottom: 6 }}>
            Your tiles
          </div>
          <div className="tile-row">
            {g.me.map((t, i) => {
              const canPlay = myPlayable.some((p) => p[0] === t[0] && p[1] === t[1]);
              return (
                <button
                  key={`${t[0]}-${t[1]}-${i}`}
                  className={`domino ${canPlay ? 'is-playable' : ''}`}
                  disabled={!canPlay || g.turn !== 'me' || g.over}
                  onClick={() => play(t, 'me')}
                >
                  <span>{t[0]}</span>
                  <span>{t[1]}</span>
                </button>
              );
            })}
          </div>
        </div>
        {g.over ? (
          <div className="note-box">
            <b>{g.log}</b>
            <div style={{ marginTop: 8 }}>
              <Button size="sm" onClick={() => setG(dealDominoes())}>
                Play again
              </Button>
            </div>
          </div>
        ) : (
          <p className="small muted">{g.log}</p>
        )}
      </div>
    </Card>
  );
}
