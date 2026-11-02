// Tiny JSON store: one file, debounced atomic writes. Enough for a single-process
// prototype and it keeps the whole data set inspectable/backup-able.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { seedResources, seedResidency, seedPeople } from './seed.js';
import { seedCommunity, seedExtraPeople } from './seed2.js';

const here = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = process.env.NORTHLIGHT_DATA_DIR || path.join(here, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

export const nowIso = () => new Date().toISOString();
export const minutesAgo = (m) => new Date(Date.now() - m * 60000).toISOString();
export const daysAgo = (d) => minutesAgo(d * 1440);
export const newId = (prefix) => `${prefix}-${crypto.randomBytes(5).toString('hex')}`;

export function hashPin(pin, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(pin), salt, 32).toString('hex');
  return { salt, hash };
}

export function verifyPin(pin, salt, hash) {
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(String(pin), salt, 32);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

export function inviteCode(name) {
  const first = (name || 'friend').trim().split(/\s+/)[0].replace(/[^a-z]/gi, '').toUpperCase().slice(0, 6) || 'NORTH';
  const tail = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `${first}-${tail}`;
}

const threadKey = (a, b) => [a, b].sort().join('::');

function seedDb() {
  const users = [...seedPeople, ...seedExtraPeople].map((p) => {
    const { salt, hash } = hashPin(p.pin);
    const { pin, ...rest } = p;
    return {
      ...rest,
      salt,
      hash,
      email: '',
      inviteCode: inviteCode(p.name),
      createdAt: daysAgo(90),
      lastSeen: minutesAgo(5),
      shareLastKnown: true,
      isSystem: false,
      housingStatus: p.housingStatus || 'homeless',
      pageHidden: false,
      requestPolicy: 'everyone',
      socials: p.socials || {},
      notify: { love: true, comments: true, requests: true, games: true, news: false },
    };
  });

  users.push({
    id: 'u-guide',
    handle: 'northlight',
    name: 'Northlight Guide',
    bio: 'Tips, never spam. Here if you need a hand.',
    story: 'We built Northlight with people who have slept outside. Everything here is yours to switch off.',
    passions: ['Helping'],
    highSchool: '',
    college: '',
    gradYear: '',
    avatarColor: '#7fb3a6',
    location: null,
    lastKnown: null,
    shareLocation: false,
    shareLastKnown: false,
    isSystem: true,
    salt: '',
    hash: '',
    email: '',
    inviteCode: 'NORTH-GUIDE',
    createdAt: daysAgo(300),
    lastSeen: nowIso(),
  });

  const m = (a, b, from, body, mins) => ({
    id: newId('m'),
    a,
    b,
    from,
    body,
    at: minutesAgo(mins),
    read: false,
  });

  const messages = [
    m('u-maya', 'u-ana', 'u-ana', 'Hey. I am not trying to argue. Just tell me you are okay tonight.', 180),
    m('u-maya', 'u-ana', 'u-maya', 'I am okay. Ate at Open Table. Sleeping at Willow.', 174),
    m('u-maya', 'u-ana', 'u-ana', 'Come by Sunday? I have the couch and the kettle. Bring nothing.', 168),
    m('u-maya', 'u-ana', 'u-ana', 'Also — I found a photo of us at the lake. I will leave a print at the day center for you.', 34),
    m('u-maya', 'u-devon', 'u-devon', 'Saw the housing list. I can drive you to the Harbor Lofts office Thursday morning, I am off at 9.', 300),
    m('u-maya', 'u-devon', 'u-maya', 'Thursday works. Thank you.', 290),
    m('u-maya', 'u-tuck', 'u-tuck', 'Water point on Civic Plaza is running all night. Do not drink from the south spigot, it is rusty.', 55),
    m('u-maya', 'u-guide', 'u-guide', 'Welcome to Northlight, Maya. Start on Home and tap "Share my spot" — you choose exactly who sees it, and you can switch it off any time.', 2 * 1440),
  ];

  const posts = [
    {
      id: newId('p'),
      authorId: 'u-maya',
      kind: 'story',
      title: 'The kitchen I want back',
      body:
        'I cooked for eleven years. I can break down a chicken in four minutes and I can feed sixty people on forty dollars. Losing my apartment did not take that. If you run a kitchen and you need a prep cook who will show up early, I am right here.',
      tags: ['work', 'cooking'],
      at: minutesAgo(220),
      cheers: ['u-devon', 'u-jules', 'u-roz', 'u-tuck'],
    },
    {
      id: newId('p'),
      authorId: 'u-tuck',
      kind: 'passion',
      title: 'My list of doors that are open at 2 AM',
      body:
        'Bathrooms: Central Library lobby (until 8), the diner on 5th if you buy a coffee, Civic Plaza fountain side. Guards who will not move you along: the tall one at the library named Ellis, and the woman at the day center desk. I will keep adding.',
      tags: ['survival', 'water'],
      at: minutesAgo(400),
      cheers: ['u-maya', 'u-roz'],
    },
    {
      id: newId('p'),
      authorId: 'u-roz',
      kind: 'story',
      title: 'Eight months nobody knew',
      body:
        'I was homeless at 61 and I was very good at hiding it. I showered at the day center before my volunteer shift and I kept my bag in a library locker. If you are hiding too: you are allowed to stop hiding. The first person I told was a stranger at a bus stop, and she bought me a sandwich and did not ask me a single question.',
      tags: ['housing', 'hope'],
      at: minutesAgo(1500),
      cheers: ['u-maya', 'u-ana', 'u-jules'],
    },
    {
      id: newId('p'),
      authorId: 'u-jules',
      kind: 'passion',
      title: 'My truck runs on dish shifts',
      body:
        'Cash at the end of every shift, no bank account, no address needed. Two hours of dishes buys a week of food. Come by the cart pod on 5th and say Northlight sent you.',
      tags: ['work', 'food'],
      at: minutesAgo(900),
      cheers: ['u-maya', 'u-devon', 'u-tuck'],
    },
    {
      id: newId('p'),
      authorId: 'u-devon',
      kind: 'story',
      title: 'I drove past her for a month',
      body:
        'Maya and I ran the 4x400 together in 2009. I saw her at the light on Grand and I did not stop, because I did not want to embarrass her. That was a bad reason. Now the truck has water, socks and a phone charger in it.',
      tags: ['friends', 'guilt'],
      at: minutesAgo(2600),
      cheers: ['u-maya', 'u-ana', 'u-roz', 'u-jules'],
    },
  ];

  const item = (ownerId, kind, title, note, progress, done, extra = {}) => ({
    id: newId('i'),
    ownerId,
    kind,
    title,
    note,
    progress,
    done,
    at: minutesAgo(300),
    claimedBy: null,
    claimedAt: null,
    ...extra,
  });

  const items = [
    item('u-maya', 'need', 'A working phone charger (USB-C)', 'Mine got wet at the fountain. Any cable works.', 0, false),
    item('u-maya', 'need', 'Ride to the Harbor Lofts office Thursday, 9 AM', 'Devon offered. Posting in case that falls through.', 50, false),
    item('u-maya', 'want', 'A quiet kitchen I can use for two hours on Sundays', 'I will cook for whoever is there. That is the deal.', 20, false),
    item('u-maya', 'goal', 'Get the free residency room at Willow', 'Navigator meeting is booked. Need my birth certificate copy — the day center can print it.', 60, false),
    item('u-maya', 'goal', 'Save $400 for first month at Harbor Lofts', 'Two dish shifts a week at Jules’s truck.', 25, false),
    item('u-maya', 'dream', 'Run my own six-seat breakfast counter', 'I have the menu written in a notebook. Twelve pages.', 5, false),
    item('u-maya', 'wish', 'A chef knife of my own', 'Nothing fancy. I miss the weight of a good knife in my hand.', 0, false),
    item('u-maya', 'wish', 'Two tickets to the salsa night at the Riverside', 'I used to dance every Thursday. I want one night that is not about surviving.', 0, false),
    item('u-ana', 'wish', 'A photo of me and my sister at the lake, printed and framed', 'I will pay for the frame. I just need the photo back.', 0, false),
    item('u-devon', 'want', 'Someone to watch my dog Friday 2–5 PM', 'Beans-friendly dog. Very lazy. Will pay in pizza.', 0, false),
    item('u-tuck', 'need', 'Dog food, any brand', 'Beans is out. He eats before I do, that is the rule.', 0, false),
    item('u-roz', 'want', 'Ten people to write one paragraph about their week', 'For a small zine the library will print. Handwritten is fine.', 30, false),
  ];

  return {
    version: 1,
    users,
    sessions: {},
    requests: [
      { id: newId('rq'), from: 'u-jules', to: 'u-maya', relationship: 'friend', status: 'pending', at: minutesAgo(120) },
      { id: newId('rq'), from: 'u-maya', to: 'u-roz', relationship: 'friend', status: 'pending', at: minutesAgo(600) },
    ],
    circle: [
      { a: 'u-maya', b: 'u-ana', relationship: 'family', since: daysAgo(80) },
      { a: 'u-maya', b: 'u-devon', relationship: 'friend', since: daysAgo(20) },
      { a: 'u-maya', b: 'u-tuck', relationship: 'friend', since: daysAgo(60) },
      { a: 'u-ana', b: 'u-devon', relationship: 'friend', since: daysAgo(15) },
      { a: 'u-roz', b: 'u-tuck', relationship: 'friend', since: daysAgo(10) },
    ],
    messages,
    posts,
    items,
    deliveries: [
      {
        id: newId('d'),
        userId: 'u-maya',
        resourceId: 'r-table',
        resourceName: 'Open Table Kitchen',
        meal: 'Hot dinner — chicken rice bowl',
        note: 'Two forks if you have them. I am sharing.',
        status: 'open',
        at: minutesAgo(14),
        etaMinutes: 40,
        courier: 'Marcus (bike)',
        locationLabel: 'Near Open Table Kitchen, Alder St',
      },
    ],
    residencyApps: [
      {
        id: newId('ra'),
        userId: 'u-maya',
        listingId: 'h-free-1',
        note: 'I am on the Willow waitlist already. I can meet a navigator any weekday morning.',
        status: 'in review',
        at: daysAgo(2),
      },
    ],
    resources: seedResources,
    residency: seedResidency,
    ...seedCommunity,
  };
}

/** Older db.json files predate the community features; fill in what is missing. */
function migrate(d) {
  let changed = false;
  const ensure = (key, value) => {
    if (!(key in d)) {
      d[key] = value;
      changed = true;
    }
  };
  ensure('media', []);
  ensure('successStories', []);
  ensure('notifications', []);
  ensure('tables', []);
  ensure('soloScores', []);
  ensure('daily', {});
  ensure('sos', []);
  ensure('blocks', []);
  for (const u of d.users || []) {
    if (!u.housingStatus) u.housingStatus = 'homeless';
    if (u.pageHidden === undefined) u.pageHidden = false;
    if (!u.requestPolicy) u.requestPolicy = 'everyone';
    if (!u.socials) u.socials = {};
    if (!u.notify) u.notify = { love: true, comments: true, requests: true, games: true, news: false };
  }
  return changed;
}

let db = null;
let saveTimer = null;

function ensureLoaded() {
  if (db) return db;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(DB_FILE)) {
    try {
      db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      // Static catalogue always tracks the latest seed; user data persists.
      db.resources = seedResources;
      db.residency = seedResidency;
      if (migrate(db)) flushNow();
      return db;
    } catch (err) {
      console.error('[store] could not read db.json, reseeding:', err.message);
    }
  }
  db = seedDb();
  flushNow();
  return db;
}

export function getDb() {
  return ensureLoaded();
}

export function flushNow() {
  if (!db) return;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${DB_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

export function save() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      flushNow();
    } catch (err) {
      console.error('[store] write failed:', err.message);
    }
  }, 120);
  saveTimer.unref?.();
}

export function resetDb() {
  db = seedDb();
  flushNow();
  return db;
}

export { threadKey };
