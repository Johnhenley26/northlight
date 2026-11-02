// Games. Online tables are server-authoritative so two phones cannot disagree
// about whose turn it is. Solo games run on the client, but scores and the daily
// puzzle live here so everyone gets the same word on the same day.
import crypto from 'node:crypto';
import { getDb, save, newId, nowIso } from './store.js';

const GAMES = ['dominoes', 'wordduel', 'blackjack'];
const WORDS = `ABOUT ABOVE ACTOR ACUTE ADOPT ADULT AFTER AGAIN AGENT AGREE AHEAD ALARM ALBUM ALERT ALIKE
ALIVE ALLOW ALONE ALONG ALTER AMONG ANGER ANGLE ANGRY APART APPLE APPLY ARENA ARGUE ARISE ARRAY ASIDE
ASSET AUDIO AUDIT AVOID AWARD AWARE BADLY BAKER BASIC BEACH BEGAN BEGIN BEING BELOW BENCH BIRTH BLACK
BLAME BLIND BLOCK BLOOD BOARD BOOST BOOTH BOUND BRAIN BRAND BRAVE BREAD BREAK BREED BRIEF BRING BROAD
BROKE BROWN BUILD BUILT BUYER CARRY CATCH CAUSE CHAIN CHAIR CHART CHASE CHEAP CHECK CHEST CHIEF CHILD
CHOSE CIVIL CLAIM CLASS CLEAN CLEAR CLIMB CLOCK CLOSE COACH COAST COULD COUNT COURT COVER CRAFT CRASH
CREAM CRIME CROSS CROWD CROWN CURVE CYCLE DAILY DANCE DEALT DEATH DEPTH DOING DOUBT DOZEN DRAFT DRAMA
DREAM DRESS DRINK DRIVE EAGER EARLY EARTH EIGHT EMPTY ENJOY ENTER ENTRY EQUAL ERROR EVENT EVERY EXACT
EXIST EXTRA FAITH FALSE FAULT FENCE FIELD FIFTH FIGHT FINAL FIRST FLASH FLEET FLOOR FOCUS FORCE FORTH
FORTY FORUM FOUND FRAME FRESH FRONT FRUIT FULLY FUNNY GIANT GIVEN GLASS GLOBE GOING GRACE GRADE GRAND
GRANT GRASS GREAT GREEN GROUP GROWN GUARD GUESS GUEST GUIDE HAPPY HEART HEAVY HORSE HOTEL HOUSE HUMAN
IDEAL IMAGE INDEX INNER INPUT ISSUE JOINT JUDGE KNOWN LABEL LARGE LASER LATER LAUGH LAYER LEARN LEAST
LEAVE LEGAL LEVEL LIGHT LIMIT LOCAL LOGIC LOOSE LOWER LUCKY LUNCH MAGIC MAJOR MAKER MEDIA METAL MIGHT
MINOR MODEL MONEY MONTH MORAL MOTOR MOUNT MOUSE MOUTH MOVIE MUSIC NEVER NIGHT NOISE NORTH NOVEL NURSE
OCCUR OCEAN OFFER OFTEN ORDER OTHER OUGHT PAINT PANEL PAPER PARTY PEACE PHASE PHONE PHOTO PIECE PILOT
PITCH PLACE PLAIN PLANE PLANT PLATE POINT POUND POWER PRESS PRICE PRIDE PRIME PRINT PRIOR PRIZE PROOF
PROUD PROVE QUICK QUIET QUITE RADIO RAISE RANGE RAPID REACH READY REALM REBEL REFER RELAX REPLY RIGHT
RIVAL RIVER ROUGH ROUND ROUTE ROYAL RURAL SCALE SCENE SCOPE SCORE SENSE SERVE SEVEN SHALL SHAPE SHARE
SHARP SHEET SHELF SHELL SHIFT SHINE SHIRT SHOCK SHOOT SHORT SHOWN SIGHT SILLY SINCE SIXTH SKILL SLEEP
SLIDE SMALL SMART SMILE SOLID SOLVE SORRY SOUND SOUTH SPACE SPEAK SPEED SPEND SPENT SPLIT SPOKE SPORT
STAFF STAGE STAND START STATE STEAM STEEL STICK STILL STOCK STONE STOOD STORE STORM STORY STRIP STUDY
STUFF STYLE SUGAR SUITE SUPER SWEET TABLE TAKEN TASTE TEACH TEETH THANK THEFT THEIR THEME THERE THESE
THICK THING THINK THIRD THOSE THREE THREW THROW THUMB TIGHT TIMES TIRED TITLE TODAY TOPIC TOTAL TOUCH
TOUGH TOWER TRACK TRADE TRAIN TREAT TREND TRIAL TRIBE TRICK TRIED TRUCK TRULY TRUST TRUTH TWICE UNDER
UNION UNITY UNTIL UPPER UPSET URBAN USAGE USUAL VALID VALUE VIDEO VISIT VITAL VOICE WASTE WATCH WATER
WHEEL WHERE WHICH WHILE WHITE WHOLE WHOSE WOMAN WOMEN WORLD WORRY WORSE WORST WORTH WOULD WOUND WRITE
WRONG WROTE YIELD YOUNG YOUTH`.split(/\s+/).filter((w) => w.length === 5);

const shuffle = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const dayKey = () => new Date().toISOString().slice(0, 10);
const dailyWord = (day = dayKey()) => {
  const days = Math.floor(Date.parse(`${day}T00:00:00Z`) / 86400000);
  return WORDS[days % WORDS.length];
};

export function marksFor(guess, word) {
  const g = String(guess).toUpperCase().split('');
  const w = String(word).toUpperCase().split('');
  const marks = new Array(g.length).fill('absent');
  const pool = {};
  for (let i = 0; i < w.length; i++) if (g[i] !== w[i]) pool[w[i]] = (pool[w[i]] || 0) + 1;
  for (let i = 0; i < g.length; i++) if (g[i] === w[i]) marks[i] = 'correct';
  for (let i = 0; i < g.length; i++) {
    if (marks[i] === 'correct') continue;
    if (pool[g[i]] > 0) {
      marks[i] = 'present';
      pool[g[i]] -= 1;
    }
  }
  return marks;
}

/* ------------------------------- blackjack -------------------------------- */

const SUITS = ['S', 'H', 'D', 'C'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function newDeck() {
  const deck = [];
  for (const s of SUITS) for (const r of RANKS) deck.push({ r, s });
  return shuffle(deck);
}

function handValue(cards) {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    if (c.r === 'A') {
      total += 11;
      aces += 1;
    } else if (['J', 'Q', 'K'].includes(c.r)) total += 10;
    else total += Number(c.r);
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return total;
}

const isNatural = (cards) => cards.length === 2 && handValue(cards) === 21;

function dealBlackjack(t) {
  const deck = newDeck();
  const [p1, p2] = t.players;
  t.state = {
    game: 'blackjack',
    deck,
    hands: { [p1]: [], [p2]: [] },
    dealer: [],
    done: { [p1]: false, [p2]: false },
    finished: false,
    log: ['Cards dealt. Dealer stands on 17.'],
    winner: null,
  };
  for (let i = 0; i < 2; i++) {
    t.state.hands[p1].push(deck.pop());
    t.state.hands[p2].push(deck.pop());
    t.state.dealer.push(deck.pop());
  }
}

function settleBlackjack(t) {
  const st = t.state;
  while (handValue(st.dealer) < 17) st.dealer.push(st.deck.pop());
  const dealerTotal = handValue(st.dealer);
  const payouts = {};
  for (const uid of t.players) {
    const cards = st.hands[uid];
    const total = handValue(cards);
    let pay = 0;
    if (total > 21) pay = 0;
    else if (isNatural(cards) && !isNatural(st.dealer)) pay = 1.5;
    else if (dealerTotal > 21) pay = 1;
    else if (total > dealerTotal) pay = 1;
    else if (total === dealerTotal) pay = 0.5;
    payouts[uid] = pay;
  }
  st.payouts = payouts;
  st.finished = true;
  const [p1, p2] = t.players;
  if (payouts[p1] === payouts[p2]) {
    t.winnerId = null;
    st.log.unshift(`Dealer ${dealerTotal}. Push — both paid the same.`);
  } else {
    t.winnerId = payouts[p1] > payouts[p2] ? p1 : p2;
    const name = t.players.find((x) => x === t.winnerId);
    st.log.unshift(`Dealer ${dealerTotal}. ${name === p1 ? 'Player one' : 'Player two'} wins the table.`);
  }
  t.status = 'done';
}

/* --------------------------------- dominoes -------------------------------- */

function dealDominoes(t) {
  const tiles = [];
  for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) tiles.push([a, b]);
  shuffle(tiles);
  const [p1, p2] = t.players;
  t.state = {
    game: 'dominoes',
    hands: { [p1]: tiles.splice(0, 7), [p2]: tiles.splice(0, 7) },
    boneyard: tiles,
    board: [],
    turn: p1,
    passes: 0,
    winner: null,
    log: ['Double-six dominoes. Seven tiles each.'],
  };
}

const pips = (hand) => hand.reduce((n, t) => n + t[0] + t[1], 0);
const fits = (tile, end) => tile[0] === end || tile[1] === end;
const playableTiles = (hand, st) => {
  if (!st.board.length) return hand.slice();
  const left = st.board[0].a;
  const right = st.board[st.board.length - 1].b;
  return hand.filter((t) => fits(t, left) || fits(t, right));
};

function playDomino(t, uid, tile, end) {
  const st = t.state;
  const hand = st.hands[uid];
  const idx = hand.findIndex((x) => x[0] === Number(tile?.[0]) && x[1] === Number(tile?.[1]));
  if (idx < 0) return { error: 'That tile is not in your hand.' };
  const [x, y] = hand[idx];
  if (st.board.length) {
    const leftEnd = st.board[0].a;
    const rightEnd = st.board[st.board.length - 1].b;
    const side = end === 'left' ? 'left' : 'right';
    const target = side === 'left' ? leftEnd : rightEnd;
    if (!fits([x, y], target))
      return { error: `That tile does not match the ${side} end (${target}).` };
    hand.splice(idx, 1);
    if (side === 'left') {
      const oriented = y === target ? { a: x, b: y } : { a: y, b: x };
      st.board.unshift(oriented);
    } else {
      const oriented = x === target ? { a: x, b: y } : { a: y, b: x };
      st.board.push(oriented);
    }
  } else {
    hand.splice(idx, 1);
    st.board.push({ a: x, b: y });
  }
  st.passes = 0;
  st.turn = t.players.find((p) => p !== uid);
  if (!hand.length) {
    st.winner = uid;
    t.winnerId = uid;
    t.status = 'done';
    st.log.unshift('Domino — hand emptied.');
  }
  return null;
}

function passDomino(t, uid) {
  const st = t.state;
  if (playableTiles(st.hands[uid], st).length)
    return { error: 'You still have a playable tile.' };
  st.passes += 1;
  st.turn = t.players.find((p) => p !== uid);
  if (st.passes >= 2) {
    const [p1, p2] = t.players;
    const a = pips(st.hands[p1]);
    const b = pips(st.hands[p2]);
    if (a === b) {
      t.winnerId = null;
      st.log.unshift(`Blocked. Both hold ${a} pips — draw.`);
    } else {
      t.winnerId = a < b ? p1 : p2;
      st.log.unshift(`Blocked. ${a} pips to ${b} — lowest hand wins.`);
    }
    st.winner = t.winnerId;
    t.status = 'done';
  }
  return null;
}

/* -------------------------------- word duel -------------------------------- */

function dealWord(t) {
  const word = WORDS[crypto.randomInt(WORDS.length)];
  const [p1, p2] = t.players;
  t.state = {
    game: 'wordduel',
    word,
    guesses: { [p1]: [], [p2]: [] },
    solvedBy: null,
    log: ['Same five-letter word for both of you. Six guesses each. First to solve wins.'],
    finished: false,
  };
}

function guessWord(t, uid, guess) {
  const st = t.state;
  const word = String(guess || '').toUpperCase().trim();
  if (!/^[A-Z]{5}$/.test(word)) return { error: 'Five letters, A–Z.' };
  if (st.finished) return { error: 'This table is finished.' };
  if (st.guesses[uid].length >= 6) return { error: 'You have used all six guesses.' };
  if (st.solvedBy === uid) return { error: 'You already got it.' };
  const marks = marksFor(word, st.word);
  st.guesses[uid].push({ word, marks });
  if (word === st.word) {
    st.solvedBy = uid;
    t.winnerId = uid;
    t.status = 'done';
    st.finished = true;
    st.log.unshift(`Solved in ${st.guesses[uid].length}.`);
  } else {
    const [p1, p2] = t.players;
    if (st.guesses[p1].length >= 6 && st.guesses[p2].length >= 6) {
      st.finished = true;
      t.status = 'done';
      t.winnerId = null;
      st.log.unshift('Nobody solved it. The word was shared after the last guess.');
    }
  }
  return null;
}

/* --------------------------------- table ops -------------------------------- */

function other(t, uid) {
  return t.players.find((p) => p !== uid);
}

function startTable(t) {
  if (t.game === 'dominoes') dealDominoes(t);
  else if (t.game === 'blackjack') dealBlackjack(t);
  else dealWord(t);
  t.status = 'playing';
  t.updatedAt = nowIso();
}

function endByForfeit(t, quitter) {
  t.status = 'done';
  t.winnerId = other(t, quitter) || null;
  if (t.state) t.state.log = [...(t.state.log || []), 'Opponent left the table.'];
}

function tableView(t, viewerId) {
  const d = getDb();
  const players = t.players.map((id) => {
    const u = d.users.find((x) => x.id === id) || {};
    return { id, name: u.name || 'Player', handle: u.handle || '', avatarColor: u.avatarColor || '#f0a04b' };
  });
  const st = t.state || {};
  let state = null;
  if (t.game === 'dominoes') {
    const board = st.board || [];
    const hand = (st.hands?.[viewerId] || []).slice();
    // An open table has no state yet, so this has to work before the deal too.
    const playable = !hand.length
      ? []
      : !board.length
      ? hand.map((x) => `${x[0]}-${x[1]}`)
      : hand
          .filter((x) => fits(x, board[0].a) || fits(x, board[board.length - 1].b))
          .map((x) => `${x[0]}-${x[1]}`);
    state = {
      board,
      turn: st.turn || null,
      passes: st.passes || 0,
      boneyard: (st.boneyard || []).length,
      hand,
      counts: Object.fromEntries(t.players.map((p) => [p, (st.hands?.[p] || []).length])),
      playable,
      log: st.log || [],
    };
  } else if (t.game === 'wordduel') {
    state = {
      guesses: st.guesses || {},
      solvedBy: st.solvedBy || null,
      finished: !!st.finished,
      answer: st.finished ? st.word : null,
      log: st.log || [],
    };
  } else if (t.game === 'blackjack') {
    state = {
      hands: st.hands || {},
      dealer: (st.dealer || []).map((c, i) => (i === 1 && !st.finished ? null : c)),
      totals: Object.fromEntries(t.players.map((p) => [p, handValue(st.hands?.[p] || [])])),
      dealerTotal: st.finished ? handValue(st.dealer || []) : handValue((st.dealer || []).slice(0, 1)),
      done: st.done || {},
      finished: !!st.finished,
      payouts: st.payouts || null,
      log: st.log || [],
    };
  }
  return {
    id: t.id,
    game: t.game,
    hostId: t.hostId,
    players,
    visibility: t.visibility,
    status: t.status,
    winnerId: t.winnerId || null,
    state,
    you: viewerId,
    at: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

function prune(d) {
  if (!d.tables) d.tables = [];
  const cutoff = Date.now() - 6 * 60 * 60 * 1000;
  d.tables = d.tables.filter((t) => Date.parse(t.updatedAt || t.createdAt) > cutoff || t.status !== 'done');
}

function myResult(t, uid, state) {
  if (t.winnerId === uid) return 'won';
  if (!t.winnerId && t.status === 'done') return 'draw';
  if (t.status === 'done') return 'lost';
  return null;
}

export function registerGames(app, h) {
  /* daily word */
  app.get('/api/games/daily', h.requireUser, (req, res) => {
    const me = req.user;
    const d = getDb();
    if (!d.daily) d.daily = {};
    const key = `${me.id}:${dayKey()}`;
    const row = d.daily[key] || { guesses: [], solved: false, done: false };
    res.json({
      date: dayKey(),
      guesses: row.guesses,
      solved: row.solved,
      done: row.solved || row.guesses.length >= 6,
      attemptsLeft: Math.max(0, 6 - row.guesses.length),
      answer: row.solved || row.guesses.length >= 6 ? dailyWord() : null,
    });
  });

  app.post('/api/games/daily/guess', h.requireUser, (req, res) => {
    const me = req.user;
    const d = getDb();
    if (!d.daily) d.daily = {};
    const key = `${me.id}:${dayKey()}`;
    const row = d.daily[key] || { guesses: [], solved: false, done: false };
    if (row.solved || row.guesses.length >= 6) return res.status(400).json({ error: 'Today is finished. A new word at midnight.' });
    const guess = String(req.body?.guess || '').toUpperCase().trim();
    if (!/^[A-Z]{5}$/.test(guess)) return res.status(400).json({ error: 'Five letters, A–Z.' });
    const word = dailyWord();
    const marks = marksFor(guess, word);
    row.guesses.push({ word: guess, marks });
    if (guess === word) row.solved = true;
    d.daily[key] = row;
    save();
    const finished = row.solved || row.guesses.length >= 6;
    if (finished) h.notifyCircle(me.id, 'game', `${me.name.split(' ')[0]} finished today's word in ${row.guesses.length}.`, null);
    res.json({
      guesses: row.guesses,
      solved: row.solved,
      done: finished,
      attemptsLeft: Math.max(0, 6 - row.guesses.length),
      answer: finished ? word : null,
    });
  });

  /* solo scores */
  app.post('/api/games/solo', h.requireUser, (req, res) => {
    const me = req.user;
    const d = getDb();
    if (!d.soloScores) d.soloScores = [];
    const game = String(req.body?.game || '').slice(0, 24);
    const score = Math.max(0, Math.round(Number(req.body?.score) || 0));
    if (!game) return res.status(400).json({ error: 'Which game?' });
    let row = d.soloScores.find((s) => s.userId === me.id && s.game === game);
    if (!row) {
      row = { userId: me.id, game, best: 0, plays: 0, at: nowIso() };
      d.soloScores.push(row);
    }
    row.plays += 1;
    row.best = Math.max(row.best, score);
    row.at = nowIso();
    save();
    const board = d.soloScores
      .filter((s) => s.game === game)
      .sort((a, b) => b.best - a.best)
      .slice(0, 10)
      .map((s) => {
        const u = d.users.find((x) => x.id === s.userId) || {};
        return { userId: s.userId, name: u.name || 'Player', handle: u.handle || '', avatarColor: u.avatarColor || '#f0a04b', best: s.best };
      });
    res.json({ best: row.best, plays: row.plays, board });
  });

  app.get('/api/games/solo', h.requireUser, (req, res) => {
    const d = getDb();
    const rows = (d.soloScores || []).slice();
    const game = String(req.query.game || '');
    const mine = rows.find((s) => s.userId === req.user.id && s.game === game);
    res.json({
      mine: mine || null,
      board: rows
        .filter((s) => s.game === game)
        .sort((a, b) => b.best - a.best)
        .slice(0, 10)
        .map((s) => {
          const u = d.users.find((x) => x.id === s.userId) || {};
          return { userId: s.userId, name: u.name || 'Player', handle: u.handle || '', avatarColor: u.avatarColor || '#f0a04b', best: s.best };
        }),
    });
  });

  /* lobby */
  app.get('/api/games', h.requireUser, (req, res) => {
    const me = req.user;
    const d = getDb();
    prune(d);
    const visible = (t) => {
      if (t.status !== 'open') return false;
      if (t.visibility === 'public') return true;
      return d.circle.some(
        (c) => (c.a === me.id && c.b === t.hostId) || (c.b === me.id && c.a === t.hostId)
      );
    };
    const open = d.tables.filter((t) => t.status === 'open' && visible(t));
    const mine = d.tables.filter((t) => t.players.includes(me.id) || t.hostId === me.id);
    res.json({
      games: GAMES,
      open: open.map((t) => tableView(t, me.id)),
      mine: mine
        .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
        .slice(0, 12)
        .map((t) => ({ ...tableView(t, me.id), result: myResult(t, me.id) })),
      daily: (() => {
        if (!d.daily) d.daily = {};
        const row = d.daily[`${me.id}:${dayKey()}`] || { guesses: [] };
        return { date: dayKey(), played: !!row.solved || row.guesses.length >= 6, guesses: row.guesses.length };
      })(),
    });
  });

  app.post('/api/games', h.requireUser, (req, res) => {
    const me = req.user;
    const d = getDb();
    if (!d.tables) d.tables = [];
    const game = String(req.body?.game || '');
    if (!GAMES.includes(game)) return res.status(400).json({ error: 'Pick a table game.' });
    const visibility = req.body?.visibility === 'circle' ? 'circle' : 'public';
    const existing = d.tables.find(
      (t) => t.hostId === me.id && t.status === 'open' && t.game === game
    );
    if (existing) return res.json({ table: tableView(existing, me.id) });
    const t = {
      id: newId('tbl'),
      game,
      hostId: me.id,
      players: [me.id],
      visibility,
      status: 'open',
      state: null,
      winnerId: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    d.tables.push(t);
    save();
    res.status(201).json({ table: tableView(t, me.id) });
  });

  app.post('/api/games/:id/join', h.requireUser, (req, res) => {
    const me = req.user;
    const d = getDb();
    prune(d);
    const t = d.tables.find((x) => x.id === req.params.id);
    if (!t) return res.status(404).json({ error: 'That table is gone.' });
    if (t.players.includes(me.id)) return res.json({ table: tableView(t, me.id) });
    if (t.status !== 'open' || t.players.length >= 2)
      return res.status(400).json({ error: 'That table is already full or finished.' });
    if (t.visibility === 'circle' && !d.circle.some((c) => (c.a === me.id && c.b === t.hostId) || (c.b === me.id && c.a === t.hostId)))
      return res.status(403).json({ error: 'That table is for the host’s circle.' });
    t.players.push(me.id);
    startTable(t);
    t.updatedAt = nowIso();
    save();
    h.notify(t.hostId, 'game', `${me.name.split(' ')[0]} joined your ${t.game} table.`, me.id, t.id);
    res.json({ table: tableView(t, me.id) });
  });

  app.get('/api/games/:id', h.requireUser, (req, res) => {
    const me = req.user;
    const d = getDb();
    const t = (d.tables || []).find((x) => x.id === req.params.id);
    if (!t) return res.status(404).json({ error: 'That table is gone.' });
    if (!t.players.includes(me.id) && t.hostId !== me.id)
      return res.status(403).json({ error: 'You are not at this table.' });
    res.json({ table: { ...tableView(t, me.id), result: myResult(t, me.id) } });
  });

  app.post('/api/games/:id/move', h.requireUser, (req, res) => {
    const me = req.user;
    const d = getDb();
    const t = (d.tables || []).find((x) => x.id === req.params.id);
    if (!t) return res.status(404).json({ error: 'That table is gone.' });
    if (!t.players.includes(me.id)) return res.status(403).json({ error: 'You are not at this table.' });
    if (t.status !== 'playing') return res.status(400).json({ error: 'This table is not being played right now.' });

    const action = String(req.body?.action || '');
    let err = null;

    if (t.game === 'dominoes') {
      if (t.state.turn !== me.id) return res.status(400).json({ error: 'Wait for your turn.' });
      if (action === 'play') err = playDomino(t, me.id, req.body?.tile, req.body?.end);
      else if (action === 'draw') {
        if (!t.state.boneyard.length) err = { error: 'The boneyard is empty — you have to pass.' };
        else {
          t.state.hands[me.id].push(t.state.boneyard.pop());
          t.state.log = [...(t.state.log || []), 'Drew from the boneyard.'];
        }
      } else if (action === 'pass') err = passDomino(t, me.id);
      else err = { error: 'Unknown move.' };
    } else if (t.game === 'wordduel') {
      if (action === 'guess') err = guessWord(t, me.id, req.body?.guess);
      else err = { error: 'Unknown move.' };
    } else if (t.game === 'blackjack') {
      const st = t.state;
      if (st.finished) err = { error: 'The hand is over.' };
      else if (st.done[me.id]) err = { error: 'You already stood.' };
      else if (action === 'hit') {
        st.hands[me.id].push(st.deck.pop());
        if (handValue(st.hands[me.id]) > 21) {
          st.done[me.id] = true;
          st.log = [...st.log, 'Bust.'];
        }
      } else if (action === 'stand') st.done[me.id] = true;
      else err = { error: 'Unknown move.' };
      if (!err && t.players.every((p) => st.done[p])) settleBlackjack(t);
    } else err = { error: 'Unknown game.' };

    if (err) return res.status(400).json(err);
    t.updatedAt = nowIso();
    save();
    if (t.status === 'done') {
      for (const p of t.players) {
        if (p === me.id) continue;
        const result = t.winnerId === p ? 'You won' : t.winnerId ? 'You lost' : 'Draw';
        h.notify(p, 'game', `${result} at ${t.game} against ${me.name.split(' ')[0]}.`, me.id, t.id);
      }
    }
    res.json({ table: { ...tableView(t, me.id), result: myResult(t, me.id) } });
  });

  app.post('/api/games/:id/leave', h.requireUser, (req, res) => {
    const me = req.user;
    const d = getDb();
    const t = (d.tables || []).find((x) => x.id === req.params.id);
    if (!t) return res.status(404).json({ error: 'That table is gone.' });
    if (t.status === 'open') {
      t.players = t.players.filter((p) => p !== me.id);
      if (!t.players.length) d.tables = d.tables.filter((x) => x.id !== t.id);
    } else if (t.status === 'playing' && t.players.includes(me.id)) {
      endByForfeit(t, me.id);
      for (const p of t.players) if (p !== me.id) h.notify(p, 'game', `${me.name.split(' ')[0]} left the table — you win by default.`, me.id, t.id);
    }
    t.updatedAt = nowIso();
    save();
    res.json({ ok: true });
  });
}
