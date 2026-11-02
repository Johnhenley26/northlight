// Northlight API — Express + JSON store.
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  getDb,
  save,
  hashPin,
  verifyPin,
  inviteCode,
  nowIso,
  newId,
  DATA_DIR,
} from './store.js';
import { notify, notifyCircle } from './notify.js';
import { registerNews } from './news.js';
import { mediaView, registerMedia } from './media.js';
import { registerGames } from './games.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 3001);
const COOKIE = 'nl_sid';

app.disable('x-powered-by');
// Photos and short reels arrive as data URLs, so the body limit is generous but capped.
app.use(express.json({ limit: '18mb' }));

/* ---------------------------------- helpers --------------------------------- */

const db = () => getDb();

function parseCookies(req) {
  const raw = req.headers.cookie || '';
  const out = {};
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function currentUser(req) {
  const sid = parseCookies(req)[COOKIE];
  if (!sid) return null;
  const d = db();
  const userId = d.sessions[sid];
  if (!userId) return null;
  return d.users.find((u) => u.id === userId) || null;
}

function requireUser(req, res, next) {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: 'Sign in to continue.' });
  req.user = user;
  user.lastSeen = nowIso();
  next();
}

function setSession(res, userId) {
  const d = db();
  const sid = crypto.randomBytes(24).toString('hex');
  d.sessions[sid] = userId;
  // keep the session table small in a long-running prototype
  const ids = Object.keys(d.sessions);
  if (ids.length > 500) delete d.sessions[ids[0]];
  save();
  const secure = process.env.NORTHLIGHT_INSECURE_COOKIE === '1' ? '' : '';
  res.setHeader(
    'Set-Cookie',
    `${COOKIE}=${sid}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}${secure}`
  );
}

function clearSession(req, res) {
  const d = db();
  const sid = parseCookies(req)[COOKIE];
  if (sid) delete d.sessions[sid];
  save();
  res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
}

const clean = (s, max = 2000) => String(s ?? '').replace(/\u0000/g, '').trim().slice(0, max);

function isInCircle(a, b) {
  return db().circle.some((c) => (c.a === a && c.b === b) || (c.a === b && c.b === a));
}

function isBlocked(a, b) {
  return (db().blocks || []).some(
    (x) => (x.by === a && x.target === b) || (x.by === b && x.target === a)
  );
}

function sameSchool(a, b) {
  const hs = a.highSchool && b.highSchool && a.highSchool.toLowerCase() === b.highSchool.toLowerCase();
  const col = a.college && b.college && a.college.toLowerCase() === b.college.toLowerCase();
  return !!(hs || col);
}

function relationshipOf(a, b) {
  const c = db().circle.find((c) => (c.a === a && c.b === b) || (c.a === b && c.b === a));
  return c ? c.relationship : null;
}

/** Privacy gate: exact coordinates only for people the sharer explicitly added. */
function spotFor(user, viewerId) {
  const inCircle = viewerId === user.id || (viewerId && isInCircle(user.id, viewerId));
  const last = user.lastKnown;
  if (!inCircle) {
    return { shared: false, label: null, lat: null, lng: null, at: null, lastKnown: null };
  }
  if (!user.shareLocation || !user.location) {
    return {
      shared: false,
      label: null,
      lat: null,
      lng: null,
      at: null,
      lastKnown: user.shareLastKnown && last ? { label: last.label, at: last.at } : null,
    };
  }
  const loc = user.location;
  const exact = loc.precision !== 'area';
  const round = (n) => Math.round(n * 200) / 200; // ~500 m grid
  return {
    shared: true,
    label: loc.label || 'Shared location',
    lat: exact ? loc.lat : round(loc.lat),
    lng: exact ? loc.lng : round(loc.lng),
    precision: loc.precision || 'area',
    at: loc.at,
    lastKnown: user.shareLastKnown && last ? { label: last.label, at: last.at } : null,
  };
}

function publicUser(user, viewer) {
  const d = db();
  const request = d.requests.find(
    (r) =>
      r.status === 'pending' &&
      ((r.from === viewer.id && r.to === user.id) || (r.from === user.id && r.to === viewer.id))
  );
  return {
    id: user.id,
    handle: user.handle,
    name: user.name,
    bio: user.bio || '',
    story: user.story || '',
    passions: user.passions || [],
    highSchool: user.highSchool || '',
    college: user.college || '',
    gradYear: user.gradYear || '',
    avatarColor: user.avatarColor || '#f0a04b',
    isSystem: !!user.isSystem,
    socials: user.socials || {},
    housingStatus: user.housingStatus || 'homeless',
    housedSince: user.housedSince || '',
    pageHidden: !!user.pageHidden,
    relationship: relationshipOf(viewer.id, user.id),
    pending: request
      ? request.from === viewer.id
        ? 'outgoing'
        : 'incoming'
      : null,
    spot: spotFor(user, viewer.id),
  };
}

function threadMessages(a, b) {
  return db()
    .messages.filter((m) => (m.a === a && m.b === b) || (m.a === b && m.b === a))
    .sort((x, y) => (x.at < y.at ? -1 : 1));
}

function circleView(member, viewerId) {
  const msgs = threadMessages(viewerId, member.id);
  const last = msgs[msgs.length - 1] || null;
  return {
    ...publicUser(member, db().users.find((u) => u.id === viewerId)),
    relationshipLabel: relationshipOf(viewerId, member.id),
    lastMessage: last ? { body: last.body, at: last.at, fromMe: last.from === viewerId } : null,
    unread: msgs.filter((m) => m.from === member.id && !m.read).length,
    messages: msgs.map((m) => ({ id: m.id, fromMe: m.from === viewerId, body: m.body, at: m.at })),
  };
}

function deliveryView(d) {
  const started = new Date(d.at).getTime();
  const mins = (Date.now() - started) / 60000;
  const eta = d.etaMinutes || 40;
  let stage = 'received';
  let label = 'Received by the kitchen';
  if (mins > eta * 0.95) {
    stage = 'delivered';
    label = 'Delivered';
  } else if (mins > eta * 0.4) {
    stage = 'on the way';
    label = 'On the way';
  } else if (mins > 3) {
    stage = 'preparing';
    label = 'Being packed';
  }
  return {
    ...d,
    stage,
    stageLabel: label,
    progress: Math.max(4, Math.min(100, Math.round((mins / eta) * 100))),
    minutesLeft: Math.max(0, Math.round(eta - mins)),
  };
}

const handleOk = (h) => /^[a-z0-9][a-z0-9_.-]{2,23}$/.test(h);
const pinOk = (p) => /^\d{4,8}$/.test(String(p));

/* ----------------------------------- auth ---------------------------------- */

app.post('/api/auth/signup', (req, res) => {
  const d = db();
  const name = clean(req.body?.name, 60);
  const handle = clean(req.body?.handle, 24).toLowerCase().replace(/^@/, '');
  const pin = String(req.body?.pin ?? '');
  if (name.length < 2) return res.status(400).json({ error: 'Tell us what to call you (2+ characters).' });
  if (!handleOk(handle))
    return res
      .status(400)
      .json({ error: 'Pick a handle: 3–24 letters, numbers, dot, dash or underscore.' });
  if (!pinOk(pin)) return res.status(400).json({ error: 'Choose a 4–8 digit PIN you can remember.' });
  if (d.users.some((u) => u.handle === handle))
    return res.status(409).json({ error: 'That handle is taken. Try another.' });

  const { salt, hash } = hashPin(pin);
  const user = {
    id: newId('u'),
    handle,
    name,
    salt,
    hash,
    email: '',
    avatarColor: ['#f0a04b', '#7fb3a6', '#8ea7d8', '#c98fb0', '#e3b04b', '#9fbf7f'][
      Math.floor(Math.random() * 6)
    ],
    bio: clean(req.body?.bio, 400),
    story: '',
    passions: [],
    highSchool: clean(req.body?.highSchool, 80),
    college: clean(req.body?.college, 80),
    gradYear: clean(req.body?.gradYear, 4),
    inviteCode: inviteCode(name),
    createdAt: nowIso(),
    lastSeen: nowIso(),
    location: null,
    lastKnown: null,
    shareLocation: false,
    shareLastKnown: true,
    isSystem: false,
  };
  d.users.push(user);
  // welcome note from the guide so messaging is never an empty room
  d.messages.push({
    id: newId('m'),
    a: user.id,
    b: 'u-guide',
    from: 'u-guide',
    body: `Welcome, ${name.split(' ')[0]}. Three things you control here: who sees your spot, who is in your circle, and what you post. Tap "Share my spot" on Home and choose "Only my circle". Nothing is ever shown publicly.`,
    at: nowIso(),
    read: false,
  });
  save();
  setSession(res, user.id);
  res.status(201).json({ user: publicUser(user, user) });
});

app.post('/api/auth/login', (req, res) => {
  const d = db();
  const handle = clean(req.body?.handle, 24).toLowerCase().replace(/^@/, '');
  const pin = String(req.body?.pin ?? '');
  const user = d.users.find((u) => u.handle === handle && !u.isSystem);
  if (!user || !verifyPin(pin, user.salt, user.hash))
    return res.status(401).json({ error: 'That handle and PIN do not match.' });
  user.lastSeen = nowIso();
  save();
  setSession(res, user.id);
  res.json({ user: publicUser(user, user) });
});

app.post('/api/auth/logout', (req, res) => {
  clearSession(req, res);
  res.json({ ok: true });
});

/* -------------------------------- bootstrap -------------------------------- */

app.get('/api/bootstrap', requireUser, (req, res) => {
  const d = db();
  const me = req.user;
  const members = d.circle
    .filter((c) => c.a === me.id || c.b === me.id)
    .map((c) => d.users.find((u) => u.id === (c.a === me.id ? c.b : c.a)))
    .filter(Boolean)
    .map((u) => circleView(u, me.id));

  const incoming = d.requests
    .filter((r) => r.to === me.id && r.status === 'pending')
    .map((r) => {
      const from = d.users.find((u) => u.id === r.from);
      return from ? { ...publicUser(from, me), requestId: r.id, relationship: r.relationship } : null;
    })
    .filter(Boolean);

  const outgoing = d.requests
    .filter((r) => r.from === me.id && r.status === 'pending')
    .map((r) => {
      const to = d.users.find((u) => u.id === r.to);
      return to ? { ...publicUser(to, me), requestId: r.id } : null;
    })
    .filter(Boolean);

  const messages = d.messages.filter((m) => m.a === me.id || m.b === me.id);
  const items = d.items.filter((i) => i.ownerId === me.id);

  res.json({
    me: {
      ...publicUser(me, me),
      inviteCode: me.inviteCode,
      shareLocation: !!me.shareLocation,
      shareLastKnown: me.shareLastKnown !== false,
      location: me.location,
      lastKnown: me.lastKnown,
      housingStatus: me.housingStatus || 'homeless',
      housedSince: me.housedSince || '',
      pageHidden: !!me.pageHidden,
      socials: me.socials || {},
      requestPolicy: me.requestPolicy || 'everyone',
      notifyPrefs: me.notify || { love: true, comments: true, requests: true, games: true, news: false },
    },
    notifications: notificationsFor(me.id),
    unreadNotifications: (d.notifications || []).filter((n) => n.userId === me.id && !n.read).length,
    media: (d.media || [])
      .filter((m) => m.ownerId === me.id || m.visibility !== 'circle' || isInCircle(me.id, m.ownerId))
      .slice()
      .sort((a, b) => (a.at < b.at ? 1 : -1))
      .slice(0, 60)
      .map((m) => mediaView(m, me.id)),
    successStories: successView(me.id).slice(0, 20),
    sos: (d.sos || []).filter((s) => s.userId === me.id && s.status === 'active'),
    blocks: (d.blocks || [])
      .filter((b) => b.by === me.id)
      .map((b) => {
        const u = d.users.find((x) => x.id === b.target) || {};
        return { id: u.id, name: u.name || 'Someone', handle: u.handle || '', avatarColor: u.avatarColor || '#f0a04b', at: b.at };
      }),
    circle: members.sort((x, y) => (y.lastMessage?.at || '').localeCompare(x.lastMessage?.at || '')),
    incoming,
    outgoing,
    unread: messages.filter((m) => m.from !== me.id && !m.read).length,
    posts: feed(me.id),
    items,
    deliveries: d.deliveries.filter((x) => x.userId === me.id).map(deliveryView).reverse(),
    residencyApps: d.residencyApps
      .filter((a) => a.userId === me.id)
      .map((a) => ({
        ...a,
        listing: d.residency.find((l) => l.id === a.listingId) || null,
      })),
    wishlistForMe: d.items
      .filter((i) => i.ownerId !== me.id && !i.claimedBy && (i.kind === 'wish' || i.kind === 'want' || i.kind === 'need'))
      .slice(0, 6)
      .map((i) => ({ ...i, owner: (d.users.find((u) => u.id === i.ownerId) || {}).name || 'Someone' })),
    resources: d.resources.map((r) => ({
      ...r,
      openToday: (r.days || []).includes(new Date().getDay()),
    })),
    listings: d.residency,
  });
});

function commentView(c) {
  const u = db().users.find((x) => x.id === c.fromId) || {};
  return {
    id: c.id,
    body: c.body,
    at: c.at,
    fromId: c.fromId,
    name: u.name || 'Someone',
    handle: u.handle || '',
    avatarColor: u.avatarColor || '#f0a04b',
  };
}

function feed(viewerId) {
  const d = db();
  return d.posts
    .slice()
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .filter((p) => {
      const author = d.users.find((x) => x.id === p.authorId);
      if (!author) return false;
      if (isBlocked(viewerId, p.authorId)) return false;
      if (author.pageHidden && !isInCircle(viewerId, p.authorId) && p.authorId !== viewerId) return false;
      if (p.visibility === 'circle') return p.authorId === viewerId || isInCircle(viewerId, p.authorId);
      return true;
    })
    .map((p) => {
      const u = d.users.find((x) => x.id === p.authorId) || {};
      const cheers = p.cheers || [];
      return {
        ...p,
        cheers,
        comments: (p.comments || []).map(commentView),
        shares: p.shares || 0,
        author: { id: u.id, name: u.name, handle: u.handle, avatarColor: u.avatarColor, housingStatus: u.housingStatus },
        cheersCount: cheers.length,
        cheered: cheers.includes(viewerId),
        mine: p.authorId === viewerId,
      };
    });
}

function notificationsFor(userId, limit = 50) {
  const d = db();
  return (d.notifications || [])
    .filter((n) => n.userId === userId)
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, limit)
    .map((n) => {
      const from = d.users.find((u) => u.id === n.fromId) || null;
      return {
        ...n,
        from: from
          ? { id: from.id, name: from.name, handle: from.handle, avatarColor: from.avatarColor }
          : null,
      };
    });
}

function successView(viewerId) {
  const d = db();
  return (d.successStories || [])
    .slice()
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .filter((s) => !isBlocked(viewerId, s.authorId))
    .map((s) => {
      const u = d.users.find((x) => x.id === s.authorId) || {};
      const likes = s.likes || [];
      const anon = !!s.anonymous;
      return {
        ...s,
        likes,
        author: anon
          ? { id: '', name: 'Someone who got out', handle: '', avatarColor: '#9fbf7f', housedSince: u.housedSince || '' }
          : {
              id: u.id,
              name: u.name || 'Someone who got out',
              handle: u.handle || '',
              avatarColor: u.avatarColor || '#9fbf7f',
              housedSince: u.housedSince || '',
            },
        likesCount: likes.length,
        liked: likes.includes(viewerId),
        mine: !anon && s.authorId === viewerId,
        comments: (s.comments || []).map(commentView),
      };
    });
}

/* --------------------------------- profile -------------------------------- */

app.patch('/api/me', requireUser, (req, res) => {
  const me = req.user;
  const b = req.body || {};
  if (typeof b.name === 'string' && b.name.trim().length >= 2) me.name = clean(b.name, 60);
  if (typeof b.bio === 'string') me.bio = clean(b.bio, 600);
  if (typeof b.story === 'string') me.story = clean(b.story, 4000);
  if (Array.isArray(b.passions))
    me.passions = b.passions.map((p) => clean(p, 40)).filter(Boolean).slice(0, 12);
  if (typeof b.highSchool === 'string') me.highSchool = clean(b.highSchool, 80);
  if (typeof b.college === 'string') me.college = clean(b.college, 80);
  if (typeof b.gradYear === 'string') me.gradYear = clean(b.gradYear, 4);
  if (typeof b.avatarColor === 'string' && /^#[0-9a-f]{6}$/i.test(b.avatarColor))
    me.avatarColor = b.avatarColor;
  if (typeof b.shareLastKnown === 'boolean') me.shareLastKnown = b.shareLastKnown;
  if (typeof b.requestPolicy === 'string' && ['everyone', 'classmates', 'nobody'].includes(b.requestPolicy))
    me.requestPolicy = b.requestPolicy;
  if (b.socials && typeof b.socials === 'object') {
    me.socials = {
      facebook: clean(b.socials.facebook, 80),
      messenger: clean(b.socials.messenger, 80),
      instagram: clean(b.socials.instagram, 80),
    };
  }
  if (b.notifyPrefs && typeof b.notifyPrefs === 'object') {
    me.notify = {
      love: b.notifyPrefs.love !== false,
      comments: b.notifyPrefs.comments !== false,
      requests: b.notifyPrefs.requests !== false,
      games: b.notifyPrefs.games !== false,
      news: !!b.notifyPrefs.news,
    };
  }
  if (typeof b.pageHidden === 'boolean') me.pageHidden = b.pageHidden;
  save();
  res.json({ me: publicUser(me, me) });
});

/* -------------------------------- location -------------------------------- */

app.post('/api/location', requireUser, (req, res) => {
  const me = req.user;
  const b = req.body || {};
  const resource = b.resourceId ? db().resources.find((r) => r.id === b.resourceId) : null;
  const lat = Number(resource ? resource.lat : b.lat);
  const lng = Number(resource ? resource.lng : b.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
    return res.status(400).json({ error: 'That location did not look right.' });
  const label = clean(resource ? resource.name : b.label, 120) || 'Shared location';
  const precision = b.precision === 'exact' ? 'exact' : 'area';
  const at = nowIso();
  me.location = { lat, lng, label, precision, at };
  me.lastKnown = { lat, lng, label, at }; // always recorded, even when sharing is off
  me.shareLocation = b.shareLocation === false ? false : true;
  save();
  res.json({ spot: spotFor(me, me.id), me: publicUser(me, me) });
});

app.patch('/api/location/settings', requireUser, (req, res) => {
  const me = req.user;
  const b = req.body || {};
  if (typeof b.shareLocation === 'boolean') me.shareLocation = b.shareLocation;
  if (typeof b.shareLastKnown === 'boolean') me.shareLastKnown = b.shareLastKnown;
  if (b.precision === 'exact' || b.precision === 'area') {
    if (me.location) me.location.precision = b.precision;
  }
  save();
  res.json({ me: publicUser(me, me), shareLocation: me.shareLocation });
});

app.get('/api/people', requireUser, (req, res) => {
  const me = req.user;
  const q = clean(req.query.q, 60).toLowerCase();
  const school = clean(req.query.school, 80).toLowerCase();
  const mode = req.query.mode === 'classmates' ? 'classmates' : 'all';
  const d = db();
  const people = d.users
    .filter((u) => u.id !== me.id && !u.isSystem)
    .filter((u) => !isBlocked(me.id, u.id))
    .filter((u) => !u.pageHidden || isInCircle(me.id, u.id))
    .filter((u) => {
      if (!q && !school && mode !== 'classmates') return true;
      const hay = [u.name, u.handle, u.highSchool, u.college, (u.passions || []).join(' '), u.bio]
        .join(' ')
        .toLowerCase();
      const matchesQ = q ? hay.includes(q) : true;
      const matchesSchool = school
        ? (u.highSchool || '').toLowerCase().includes(school) ||
          (u.college || '').toLowerCase().includes(school)
        : true;
      const classmate =
        mode === 'classmates'
          ? !!(
              (me.highSchool && u.highSchool && me.highSchool.toLowerCase() === u.highSchool.toLowerCase()) ||
              (me.college && u.college && me.college.toLowerCase() === u.college.toLowerCase())
            )
          : true;
      return matchesQ && matchesSchool && classmate;
    })
    .slice(0, 40)
    .map((u) => ({
      ...publicUser(u, me),
      schoolMatch:
        me.highSchool && u.highSchool && me.highSchool.toLowerCase() === u.highSchool.toLowerCase()
          ? 'high school'
          : me.college && u.college && me.college.toLowerCase() === u.college.toLowerCase()
          ? 'college'
          : null,
    }));
  res.json({ people });
});

app.get('/api/people/:id', requireUser, (req, res) => {
  const me = req.user;
  const u = db().users.find((x) => x.id === req.params.id);
  if (!u) return res.status(404).json({ error: 'Person not found.' });
  res.json({
    person: publicUser(u, me),
    posts: feed(me.id).filter((p) => p.author.id === u.id),
    wishes: db()
      .items.filter((i) => i.ownerId === u.id && !i.done)
      .map((i) => ({ ...i, owner: u.name })),
  });
});

/* ---------------------------------- circle -------------------------------- */

app.post('/api/circle/request', requireUser, (req, res) => {
  const me = req.user;
  const d = db();
  const target = d.users.find((u) => u.id === req.body?.userId);
  if (!target || target.id === me.id) return res.status(400).json({ error: 'Pick someone else.' });
  if (isBlocked(me.id, target.id))
    return res.status(403).json({ error: 'You cannot send a request to this person.' });
  const policy = target.requestPolicy || 'everyone';
  if (policy === 'nobody')
    return res.status(403).json({ error: 'This person is not taking new requests right now.' });
  if (policy === 'classmates' && !sameSchool(me, target))
    return res.status(403).json({ error: 'This person only accepts requests from classmates.' });
  if (isInCircle(me.id, target.id))
    return res.status(400).json({ error: 'You are already in each other’s circle.' });
  const existing = d.requests.find(
    (r) =>
      r.status === 'pending' &&
      ((r.from === me.id && r.to === target.id) || (r.from === target.id && r.to === me.id))
  );
  if (existing) {
    if (existing.to === me.id) {
      existing.status = 'accepted';
      addCircleEdge(me.id, target.id, existing.relationship || 'friend');
      d.messages.push({
        id: newId('m'),
        a: me.id,
        b: target.id,
        from: target.id,
        body: 'We are connected on Northlight now.',
        at: nowIso(),
        read: false,
      });
      save();
      return res.json({ ok: true, status: 'connected' });
    }
    return res.status(400).json({ error: 'You already sent a request. It is waiting on them.' });
  }
  const relationship = ['family', 'friend', 'classmate'].includes(req.body?.relationship)
    ? req.body.relationship
    : 'friend';
  d.requests.push({
    id: newId('rq'),
    from: me.id,
    to: target.id,
    relationship,
    status: 'pending',
    at: nowIso(),
  });
  save();
  res.status(201).json({ ok: true, status: 'pending' });
});

function addCircleEdge(a, b, relationship) {
  const d = db();
  if (isInCircle(a, b)) return;
  d.circle.push({ a, b, relationship: relationship || 'friend', since: nowIso() });
}

app.post('/api/circle/respond', requireUser, (req, res) => {
  const me = req.user;
  const d = db();
  const r = d.requests.find((x) => x.id === req.body?.requestId && x.to === me.id && x.status === 'pending');
  if (!r) return res.status(404).json({ error: 'That request is no longer open.' });
  const accept = req.body?.accept !== false;
  r.status = accept ? 'accepted' : 'declined';
  if (accept) {
    addCircleEdge(me.id, r.from, r.relationship);
    d.messages.push({
      id: newId('m'),
      a: me.id,
      b: r.from,
      from: me.id,
      body: `Added you to my circle. You can message me here any time.`,
      at: nowIso(),
      read: false,
    });
  }
  save();
  res.json({ ok: true, status: r.status });
});

app.post('/api/circle/join', requireUser, (req, res) => {
  const me = req.user;
  const d = db();
  const code = clean(req.body?.code, 24).toUpperCase();
  const target = d.users.find((u) => u.inviteCode === code && u.id !== me.id);
  if (!target) return res.status(404).json({ error: 'That invite code does not match anyone.' });
  if (isBlocked(me.id, target.id))
    return res.status(403).json({ error: 'That invite code is not available to you.' });
  addCircleEdge(me.id, target.id, 'friend');
  d.messages.push({
    id: newId('m'),
    a: me.id,
    b: target.id,
    from: me.id,
    body: 'Joined with your invite code.',
    at: nowIso(),
    read: false,
  });
  save();
  res.json({ ok: true, person: publicUser(target, me) });
});

app.get('/api/circle/:id', requireUser, (req, res) => {
  const me = req.user;
  const d = db();
  const friend = d.users.find((u) => u.id === req.params.id);
  if (!friend) return res.status(404).json({ error: 'Not found.' });
  const msgs = threadMessages(me.id, friend.id).map((m) => {
    if (m.from === friend.id) m.read = true;
    return { id: m.id, fromMe: m.from === me.id, body: m.body, at: m.at };
  });
  save();
  res.json({
    person: publicUser(friend, me),
    spot: spotFor(friend, me.id),
    messages: msgs,
    wishes: d.items.filter((i) => i.ownerId === friend.id && !i.done),
  });
});

app.post('/api/messages', requireUser, (req, res) => {
  const me = req.user;
  const d = db();
  const to = d.users.find((u) => u.id === req.body?.to);
  const body = clean(req.body?.body, 1200);
  if (!to) return res.status(400).json({ error: 'Pick someone to message.' });
  if (!body) return res.status(400).json({ error: 'Write something first.' });
  if (isBlocked(me.id, to.id))
    return res.status(403).json({ error: 'You cannot message this person.' });
  if (!isInCircle(me.id, to.id))
    return res.status(403).json({ error: 'Add them to your circle before messaging.' });
  const msg = { id: newId('m'), a: me.id, b: to.id, from: me.id, body, at: nowIso(), read: false };
  d.messages.push(msg);
  save();

  // The guide answers common questions so a new account never feels like a dead end.
  if (to.isSystem) {
    const reply = guideReply(body);
    setTimeout(() => {
      d.messages.push({
        id: newId('m'),
        a: me.id,
        b: to.id,
        from: to.id,
        body: reply,
        at: nowIso(),
        read: false,
      });
      save();
    }, 900);
  }
  res.status(201).json({ ok: true, id: msg.id });
});

function guideReply(text) {
  const t = text.toLowerCase();
  if (t.includes('food') || t.includes('eat') || t.includes('hungry'))
    return 'Open Table Kitchen serves dinner 5:30–7:00 tonight and delivers within about 40 minutes. Open Help → Food & water → “Deliver to me”.';
  if (t.includes('bed') || t.includes('sleep') || t.includes('shelter'))
    return 'Willow Night Shelter has beds tonight, check-in 4–9 PM, no ID needed. If you want a room of your own, Help → Residency has a free option with no rent and no deposit.';
  if (t.includes('water'))
    return 'The Civic Plaza fountain runs 24 hours and has a bottle fill spigot on the left. Any site in Help → Food & water shows walking directions.';
  if (t.includes('location') || t.includes('privacy'))
    return 'Your spot is only ever visible to people in your circle, and only while sharing is on. Switch it off on Home and the last place you checked in is still saved just for you.';
  if (t.includes('home') || t.includes('housing') || t.includes('rent'))
    return 'Two real options right now: Northlight Free Residency ($0 rent, no deposit) and Harbor Lofts Residency Plus ($185/month, vouchers accepted). Both are in Help → Residency. I can walk you through either one.';
  return 'I am here. Ask me about food, water, a bed tonight, housing, or how your location is shared — or message a person in your circle. A real navigator checks these messages every weekday.';
}

app.delete('/api/circle/:id', requireUser, (req, res) => {
  const me = req.user;
  const d = db();
  const before = d.circle.length;
  d.circle = d.circle.filter(
    (c) =>
      !((c.a === me.id && c.b === req.params.id) || (c.b === me.id && c.a === req.params.id))
  );
  save();
  res.json({ ok: true, removed: before !== d.circle.length });
});

/* -------------------------------- resources ------------------------------- */

app.get('/api/resources', requireUser, (req, res) => {
  const type = clean(req.query.type, 20);
  const d = db();
  const day = new Date().getDay();
  const list = d.resources
    .filter((r) => !type || type === 'all' || r.type === type)
    .map((r) => ({ ...r, openToday: (r.days || []).includes(day) }));
  res.json({ resources: list, day });
});

app.post('/api/deliveries', requireUser, (req, res) => {
  const me = req.user;
  const d = db();
  const resource = d.resources.find((r) => r.id === req.body?.resourceId && r.type === 'food');
  if (!resource) return res.status(400).json({ error: 'Choose a kitchen that delivers.' });
  const spot = me.shareLocation && me.location ? me.location : me.lastKnown;
  if (!spot) return res.status(400).json({ error: 'Share a spot or check in first so we know where to bring it.' });
  const delivery = {
    id: newId('d'),
    userId: me.id,
    resourceId: resource.id,
    resourceName: resource.name,
    meal: clean(req.body?.meal, 120) || 'Hot meal',
    note: clean(req.body?.note, 300),
    servings: Math.min(6, Math.max(1, Number(req.body?.servings) || 1)),
    status: 'open',
    at: nowIso(),
    etaMinutes: 35 + Math.floor(Math.random() * 15),
    courier: ['Marcus (bike)', 'Lea (car)', 'Sam (bike)', 'Priya (car)'][Math.floor(Math.random() * 4)],
    locationLabel: spot.label,
  };
  d.deliveries.push(delivery);
  save();
  res.status(201).json({ delivery: deliveryView(delivery) });
});

app.get('/api/deliveries', requireUser, (req, res) => {
  res.json({
    deliveries: db()
      .deliveries.filter((x) => x.userId === req.user.id)
      .map(deliveryView)
      .reverse(),
  });
});

/* --------------------------------- residency ------------------------------ */

app.get('/api/residency', requireUser, (req, res) => {
  const d = db();
  res.json({
    listings: d.residency,
    applications: d.residencyApps
      .filter((a) => a.userId === req.user.id)
      .map((a) => ({ ...a, listing: d.residency.find((l) => l.id === a.listingId) || null })),
  });
});

app.post('/api/residency/apply', requireUser, (req, res) => {
  const me = req.user;
  const d = db();
  const listing = d.residency.find((l) => l.id === req.body?.listingId);
  if (!listing) return res.status(404).json({ error: 'That home is not listed.' });
  const already = d.residencyApps.find(
    (a) => a.userId === me.id && a.listingId === listing.id && a.status !== 'withdrawn'
  );
  if (already) return res.status(400).json({ error: 'You already have an open application here.' });
  const appRow = {
    id: newId('ra'),
    userId: me.id,
    listingId: listing.id,
    note: clean(req.body?.note, 600),
    contactOk: req.body?.contactOk !== false,
    status: 'submitted',
    at: nowIso(),
  };
  d.residencyApps.push(appRow);
  // A navigator opens every application with a personal note.
  d.messages.push({
    id: newId('m'),
    a: me.id,
    b: 'u-guide',
    from: 'u-guide',
    body: `Your application for ${listing.name} is in. A navigator reviews new applications within 3 business days and will message you here — not by phone, not by mail. Nothing else is needed from you right now.`,
    at: nowIso(),
    read: false,
  });
  save();
  res.status(201).json({ application: { ...appRow, listing } });
});

/* ---------------------------------- posts --------------------------------- */

app.get('/api/feed', requireUser, (req, res) => {
  res.json({ posts: feed(req.user.id) });
});

const POST_KINDS = ['story', 'passion', 'blog', 'reel'];

app.post('/api/posts', requireUser, (req, res) => {
  const me = req.user;
  const title = clean(req.body?.title, 120);
  const body = clean(req.body?.body, 8000);
  const kind = POST_KINDS.includes(req.body?.kind) ? req.body.kind : 'story';
  const mediaId = clean(req.body?.mediaId, 40) || null;
  if (mediaId) {
    const m = (db().media || []).find((x) => x.id === mediaId && x.ownerId === me.id);
    if (!m) return res.status(400).json({ error: 'That upload is not yours.' });
  }
  if (title.length < 3) return res.status(400).json({ error: 'Give it a title.' });
  if (body.length < (kind === 'reel' ? 3 : 10))
    return res.status(400).json({ error: kind === 'reel' ? 'Add a caption.' : 'A couple of sentences, at least.' });
  const post = {
    id: newId('p'),
    authorId: me.id,
    kind,
    title,
    body,
    mediaId,
    visibility: req.body?.visibility === 'circle' ? 'circle' : 'public',
    tags: Array.isArray(req.body?.tags)
      ? req.body.tags.map((t) => clean(t, 24)).filter(Boolean).slice(0, 5)
      : [],
    at: nowIso(),
    cheers: [],
    comments: [],
    shares: 0,
  };
  db().posts.push(post);
  save();
  res.status(201).json({ post });
});

app.post('/api/posts/:id/like', requireUser, (req, res) => {
  const me = req.user;
  const post = db().posts.find((p) => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found.' });
  post.cheers = post.cheers || [];
  const i = post.cheers.indexOf(me.id);
  if (i >= 0) post.cheers.splice(i, 1);
  else {
    post.cheers.push(me.id);
    if (post.authorId !== me.id)
      notify(post.authorId, 'like', `${me.name.split(' ')[0]} liked your post “${post.title}”.`, me.id, post.id);
  }
  save();
  res.json({ liked: i < 0, count: post.cheers.length });
});

app.post('/api/posts/:id/comment', requireUser, (req, res) => {
  const me = req.user;
  const post = db().posts.find((p) => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found.' });
  const body = clean(req.body?.body, 600);
  if (!body) return res.status(400).json({ error: 'Write a comment first.' });
  const author = db().users.find((u) => u.id === post.authorId);
  if (author && author.pageHidden && !isInCircle(me.id, author.id) && author.id !== me.id)
    return res.status(403).json({ error: 'That post is not public.' });
  post.comments = post.comments || [];
  post.comments.push({ id: newId('c'), fromId: me.id, body, at: nowIso() });
  save();
  if (post.authorId !== me.id)
    notify(post.authorId, 'comment', `${me.name.split(' ')[0]} commented on “${post.title}”: “${body.slice(0, 60)}”`, me.id, post.id);
  res.status(201).json({ comments: post.comments.map(commentView) });
});

app.post('/api/posts/:id/share', requireUser, (req, res) => {
  const me = req.user;
  const post = db().posts.find((p) => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found.' });
  post.shares = (post.shares || 0) + 1;
  save();
  if (post.authorId !== me.id)
    notify(post.authorId, 'share', `${me.name.split(' ')[0]} shared “${post.title}”.`, me.id, post.id);
  res.json({ shares: post.shares });
});

app.post('/api/posts/:id/cheer', requireUser, (req, res) => {
  const me = req.user;
  const post = db().posts.find((p) => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found.' });
  const i = post.cheers.indexOf(me.id);
  if (i >= 0) post.cheers.splice(i, 1);
  else post.cheers.push(me.id);
  save();
  res.json({ cheered: i < 0, count: post.cheers.length });
});

/* ------------------------- needs, wants, goals, wishes -------------------- */

const KINDS = ['need', 'want', 'goal', 'dream', 'wish'];

app.post('/api/items', requireUser, (req, res) => {
  const me = req.user;
  const kind = KINDS.includes(req.body?.kind) ? req.body.kind : 'need';
  const title = clean(req.body?.title, 140);
  if (title.length < 3) return res.status(400).json({ error: 'What is it? A few words is fine.' });
  const item = {
    id: newId('i'),
    ownerId: me.id,
    kind,
    title,
    note: clean(req.body?.note, 600),
    progress: Math.min(100, Math.max(0, Number(req.body?.progress) || 0)),
    done: false,
    at: nowIso(),
    claimedBy: null,
    claimedAt: null,
  };
  db().items.push(item);
  save();
  res.status(201).json({ item });
});

app.patch('/api/items/:id', requireUser, (req, res) => {
  const me = req.user;
  const item = db().items.find((i) => i.id === req.params.id && i.ownerId === me.id);
  if (!item) return res.status(404).json({ error: 'Not your list item.' });
  const b = req.body || {};
  if (typeof b.title === 'string' && b.title.trim().length >= 3) item.title = clean(b.title, 140);
  if (typeof b.note === 'string') item.note = clean(b.note, 600);
  if (typeof b.progress === 'number') item.progress = Math.min(100, Math.max(0, Math.round(b.progress)));
  if (typeof b.done === 'boolean') {
    item.done = b.done;
    item.progress = b.done ? 100 : item.progress;
  }
  save();
  res.json({ item });
});

app.delete('/api/items/:id', requireUser, (req, res) => {
  const me = req.user;
  const d = db();
  const before = d.items.length;
  d.items = d.items.filter((i) => !(i.id === req.params.id && i.ownerId === me.id));
  save();
  res.json({ ok: true, removed: before !== d.items.length });
});

app.post('/api/items/:id/claim', requireUser, (req, res) => {
  const me = req.user;
  const d = db();
  const item = d.items.find((i) => i.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found.' });
  if (item.ownerId === me.id) return res.status(400).json({ error: 'That one is yours already.' });
  if (item.claimedBy) return res.status(400).json({ error: 'Someone already offered on this.' });
  item.claimedBy = me.id;
  item.claimedAt = nowIso();
  if (!isInCircle(me.id, item.ownerId)) addCircleEdge(me.id, item.ownerId, 'friend');
  d.messages.push({
    id: newId('m'),
    a: me.id,
    b: item.ownerId,
    from: me.id,
    body: `I can help with “${item.title}”. Tell me where and when and I will be there.`,
    at: nowIso(),
    read: false,
  });
  save();
  res.json({ item, owner: publicUser(d.users.find((u) => u.id === item.ownerId), me) });
});

/* --------------------------- safety, love, blocks -------------------------- */

const SOS_KINDS = {
  help: 'Local help',
  ambulance: 'Ambulance',
  police: 'Police',
  narcan: 'Narcan',
};

const SOS_LINES = [
  { label: 'Emergency — ambulance, police, fire', number: '911' },
  { label: 'Suicide & Crisis Lifeline', number: '988' },
  { label: 'Never Use Alone overdose line', number: '1-800-484-3731' },
  { label: 'Poison Control', number: '1-800-222-1222' },
];

app.post('/api/sos', requireUser, (req, res) => {
  const me = req.user;
  const d = db();
  const kind = SOS_KINDS[req.body?.kind] ? req.body.kind : 'help';
  if (!d.sos) d.sos = [];
  const spot = me.shareLocation && me.location ? me.location : me.lastKnown;
  const alert = {
    id: newId('sos'),
    userId: me.id,
    kind,
    kindLabel: SOS_KINDS[kind],
    note: clean(req.body?.note, 400),
    at: nowIso(),
    status: 'active',
    locationLabel: spot ? spot.label : 'No place shared yet',
    lat: spot ? spot.lat : null,
    lng: spot ? spot.lng : null,
    circleNotified: 0,
  };
  d.sos.push(alert);
  const mates = d.circle
    .filter((c) => c.a === me.id || c.b === me.id)
    .map((c) => (c.a === me.id ? c.b : c.a))
    .filter((id) => id !== 'u-guide');
  for (const mate of mates) {
    notify(
      mate,
      'sos',
      `${me.name.split(' ')[0]} pressed SOS — ${SOS_KINDS[kind]}. ${spot ? `Last spot: ${spot.label}.` : ''} ${alert.note || ''}`.trim(),
      me.id,
      alert.id
    );
  }
  alert.circleNotified = mates.length;
  save();
  res.status(201).json({
    alert,
    lines: SOS_LINES,
    dispatched: false,
    note: 'Northlight told the people in your circle and put the real numbers in front of you. It does not call 911 for you — press the call button below.',
  });
});

app.get('/api/sos', requireUser, (req, res) => {
  const mine = (db().sos || []).filter((s) => s.userId === req.user.id && s.status === 'active');
  res.json({ sos: mine, lines: SOS_LINES });
});

app.post('/api/sos/:id/cancel', requireUser, (req, res) => {
  const alert = (db().sos || []).find((s) => s.id === req.params.id && s.userId === req.user.id);
  if (!alert) return res.status(404).json({ error: 'That alert is already closed.' });
  alert.status = 'canceled';
  alert.closedAt = nowIso();
  save();
  res.json({ ok: true });
});

app.post('/api/love', requireUser, (req, res) => {
  const me = req.user;
  const d = db();
  const target = d.users.find((u) => u.id === req.body?.userId);
  if (!target || target.id === me.id) return res.status(400).json({ error: 'Pick someone else.' });
  if (isBlocked(me.id, target.id)) return res.status(403).json({ error: 'You cannot reach this person.' });
  const note = clean(req.body?.note, 200);
  notify(
    target.id,
    'love',
    `${me.name.split(' ')[0]} sent you love${note ? `: “${note}”` : '.'}`,
    me.id,
    null
  );
  res.status(201).json({ ok: true });
});

app.get('/api/notifications', requireUser, (req, res) => {
  res.json({
    notifications: notificationsFor(req.user.id),
    unread: (db().notifications || []).filter((n) => n.userId === req.user.id && !n.read).length,
  });
});

app.post('/api/notifications/read', requireUser, (req, res) => {
  const me = req.user;
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : null;
  for (const n of db().notifications || []) {
    if (n.userId !== me.id) continue;
    if (!ids || ids.includes(n.id)) n.read = true;
  }
  save();
  res.json({ ok: true });
});

app.post('/api/blocks', requireUser, (req, res) => {
  const me = req.user;
  const d = db();
  const target = d.users.find((u) => u.id === req.body?.userId);
  if (!target || target.id === me.id) return res.status(400).json({ error: 'Pick someone else.' });
  if (!d.blocks) d.blocks = [];
  if (!d.blocks.some((b) => b.by === me.id && b.target === target.id))
    d.blocks.push({ id: newId('blk'), by: me.id, target: target.id, at: nowIso() });
  d.circle = d.circle.filter(
    (c) => !((c.a === me.id && c.b === target.id) || (c.b === me.id && c.a === target.id))
  );
  d.requests = d.requests.filter(
    (r) => !((r.from === me.id && r.to === target.id) || (r.from === target.id && r.to === me.id))
  );
  save();
  res.json({ ok: true, blocked: true });
});

app.delete('/api/blocks/:userId', requireUser, (req, res) => {
  const me = req.user;
  const d = db();
  d.blocks = (d.blocks || []).filter((b) => !(b.by === me.id && b.target === req.params.userId));
  save();
  res.json({ ok: true, blocked: false });
});

/* ------------------------------ housing, exit ----------------------------- */

app.post('/api/housing', requireUser, (req, res) => {
  const me = req.user;
  const b = req.body || {};
  const allowed = ['homeless', 'shelter', 'residency', 'housed'];
  const before = me.housingStatus || 'homeless';
  const status = allowed.includes(b.status) ? b.status : before;
  me.housingStatus = status;
  if (typeof b.hidePage === 'boolean') me.pageHidden = b.hidePage;
  if (status === 'housed' && b.housedSince) me.housedSince = clean(b.housedSince, 10);
  if (status !== before) {
    if (status === 'housed')
      notify(
        me.id,
        'housing',
        'You marked yourself housed. Your page can stay up, hide, or become a success story — all three are yours to choose.',
        null,
        null
      );
    else if (before === 'housed')
      notify(me.id, 'housing', 'You updated your housing status. Nothing else changed, and nobody was told.', null, null);
  }
  save();
  res.json({
    me: publicUser(me, me),
    housingStatus: me.housingStatus,
    pageHidden: !!me.pageHidden,
  });
});

app.post('/api/account/delete', requireUser, (req, res) => {
  const me = req.user;
  const d = db();
  if (String(req.body?.confirm || '').trim().toUpperCase() !== 'DELETE')
    return res.status(400).json({ error: 'Type DELETE to confirm.' });
  for (const m of (d.media || []).filter((x) => x.ownerId === me.id)) {
    if (!m.file) continue;
    try {
      fs.unlinkSync(path.join(DATA_DIR, 'media', m.file));
    } catch {
      /* already gone */
    }
  }
  d.media = (d.media || []).filter((x) => x.ownerId !== me.id);
  d.posts = d.posts.filter((p) => p.authorId !== me.id);
  d.items = d.items.filter((i) => i.ownerId !== me.id);
  d.messages = d.messages.filter((m) => m.a !== me.id && m.b !== me.id);
  d.circle = d.circle.filter((c) => c.a !== me.id && c.b !== me.id);
  d.requests = d.requests.filter((r) => r.from !== me.id && r.to !== me.id);
  d.notifications = (d.notifications || []).filter((n) => n.userId !== me.id);
  d.successStories = (d.successStories || []).filter((s) => s.authorId !== me.id);
  d.deliveries = d.deliveries.filter((x) => x.userId !== me.id);
  d.residencyApps = d.residencyApps.filter((a) => a.userId !== me.id);
  d.sos = (d.sos || []).filter((s) => s.userId !== me.id);
  d.tables = (d.tables || []).filter((t) => !t.players.includes(me.id));
  d.blocks = (d.blocks || []).filter((b) => b.by !== me.id && b.target !== me.id);
  d.soloScores = (d.soloScores || []).filter((s) => s.userId !== me.id);
  d.daily = Object.fromEntries(Object.entries(d.daily || {}).filter(([k]) => !k.startsWith(`${me.id}:`)));
  d.users = d.users.filter((u) => u.id !== me.id);
  for (const [sid, uid] of Object.entries(d.sessions)) if (uid === me.id) delete d.sessions[sid];
  save();
  res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
  res.json({ ok: true });
});

/* ------------------------------ success stories --------------------------- */

app.get('/api/success', requireUser, (req, res) => {
  res.json({ stories: successView(req.user.id) });
});

app.post('/api/success', requireUser, (req, res) => {
  const me = req.user;
  const d = db();
  const title = clean(req.body?.title, 140);
  const body = clean(req.body?.body, 6000);
  if (title.length < 5) return res.status(400).json({ error: 'Give your story a title.' });
  if (body.length < 60) return res.status(400).json({ error: 'Tell a little more — at least a few sentences.' });
  const yearsOut = Math.max(0, Math.min(80, Number(req.body?.yearsOut) || 0));
  if (!d.successStories) d.successStories = [];
  const story = {
    id: newId('ss'),
    authorId: me.id,
    title,
    body,
    yearsOut,
    city: clean(req.body?.city, 80),
    anonymous: req.body?.anonymous === true,
    at: nowIso(),
    likes: [],
    comments: [],
  };
  d.successStories.push(story);
  save();
  notifyCircle(me.id, 'system', `${me.name.split(' ')[0]} shared a success story: “${title}”.`, story.id);
  res.status(201).json({ story });
});

app.post('/api/success/:id/like', requireUser, (req, res) => {
  const me = req.user;
  const s = (db().successStories || []).find((x) => x.id === req.params.id);
  if (!s) return res.status(404).json({ error: 'Story not found.' });
  s.likes = s.likes || [];
  const i = s.likes.indexOf(me.id);
  if (i >= 0) s.likes.splice(i, 1);
  else {
    s.likes.push(me.id);
    if (s.authorId !== me.id)
      notify(s.authorId, 'love', `${me.name.split(' ')[0]} was moved by your story.`, me.id, s.id);
  }
  save();
  res.json({ liked: i < 0, count: s.likes.length });
});

app.post('/api/success/:id/comment', requireUser, (req, res) => {
  const me = req.user;
  const s = (db().successStories || []).find((x) => x.id === req.params.id);
  if (!s) return res.status(404).json({ error: 'Story not found.' });
  const body = clean(req.body?.body, 800);
  if (!body) return res.status(400).json({ error: 'Write something first.' });
  s.comments = s.comments || [];
  s.comments.push({ id: newId('c'), fromId: me.id, body, at: nowIso() });
  save();
  if (s.authorId !== me.id)
    notify(s.authorId, 'comment', `${me.name.split(' ')[0]} commented on your story.`, me.id, s.id);
  res.status(201).json({ comments: s.comments.map(commentView) });
});

/* -------------------------- module route groups --------------------------- */

registerNews(app, { requireUser });
registerMedia(app, { requireUser, clean, notify, notifyCircle });
registerGames(app, { requireUser, clean, notify });

/* ----------------------------------- meta --------------------------------- */

app.get('/api/health', (_req, res) => res.json({ ok: true, at: nowIso() }));

app.use('/api', (_req, res) => res.status(404).json({ error: 'Unknown endpoint.' }));

// Serve the built client when it exists (npm run build).
const dist = path.join(here, '..', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[api] error:', err.message);
  res.status(500).json({ error: 'Something went wrong on our side. Try again.' });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[northlight] api listening on http://0.0.0.0:${PORT}`);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    try {
      save();
    } catch {
      /* ignore */
    }
    server.close(() => process.exit(0));
  });
}
