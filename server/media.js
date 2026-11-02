// Photos and short reels: files on disk, metadata in the JSON store, per-person quotas.
import fs from 'node:fs';
import path from 'node:path';
import { getDb, save, newId, nowIso, DATA_DIR } from './store.js';

const MEDIA_DIR = path.join(DATA_DIR, 'media');
const LIMITS = {
  photo: { maxBytes: 4 * 1024 * 1024, quota: 25, label: 'photos' },
  reel: { maxBytes: 15 * 1024 * 1024, quota: 8, label: 'reels' },
};
const TOTAL_BYTES = 140 * 1024 * 1024;

const EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
};

function ensureDir() {
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
}

export function mediaView(m, viewerId) {
  const d = getDb();
  const owner = d.users.find((u) => u.id === m.ownerId) || {};
  return {
    id: m.id,
    ownerId: m.ownerId,
    kind: m.kind,
    mime: m.mime || 'image/svg+xml',
    seedArt: m.seedArt || 0,
    caption: m.caption || '',
    visibility: m.visibility || 'public',
    at: m.at,
    shares: m.shares || 0,
    likesCount: (m.likes || []).length,
    liked: (m.likes || []).includes(viewerId),
    mine: m.ownerId === viewerId,
    comments: (m.comments || []).map((c) => {
      const u = d.users.find((x) => x.id === c.fromId) || {};
      return { id: c.id, body: c.body, at: c.at, fromId: c.fromId, name: u.name || 'Someone', handle: u.handle || '', avatarColor: u.avatarColor || '#f0a04b' };
    }),
    author: { id: owner.id, name: owner.name || 'Someone', handle: owner.handle || '', avatarColor: owner.avatarColor || '#f0a04b' },
  };
}

const canSee = (m, viewer, d) => {
  if (m.ownerId === viewer.id) return true;
  if (m.visibility !== 'circle') return true;
  return d.circle.some(
    (c) => (c.a === m.ownerId && c.b === viewer.id) || (c.b === m.ownerId && c.a === viewer.id)
  );
};

/* --------------------------- demo artwork (seeded) -------------------------- */

const SKY = {
  1: ['#2b1d3a', '#7a3f4e', '#f0a04b'],
  2: ['#182233', '#33506a', '#e8b06a'],
  3: ['#2a2118', '#6b4a2f', '#f4c67a'],
  4: ['#1d2a2f', '#3d6660', '#e6c79a'],
  5: ['#2e1f28', '#7c4a52', '#f2b8a0'],
};

export function seedArtSvg(n) {
  const [a, b, c] = SKY[n] || SKY[1];
  const scenes = {
    1: `<circle cx="860" cy="250" r="70" fill="${c}" opacity=".9"/>
        <rect y="560" width="1200" height="340" fill="#1a1620"/>
        <g stroke="${c}" stroke-opacity=".55" stroke-width="4">
          <line x1="790" y1="600" x2="930" y2="600"/><line x1="760" y1="640" x2="960" y2="640"/>
          <line x1="800" y1="686" x2="920" y2="686"/><line x1="770" y1="740" x2="950" y2="740"/>
          <line x1="820" y1="800" x2="900" y2="800"/>
        </g>
        <path d="M120 300 q30 -26 60 0 q30 -26 60 0" stroke="#f4d9b0" stroke-width="5" fill="none" opacity=".7"/>`,
    2: `<circle cx="240" cy="210" r="54" fill="${c}" opacity=".75"/>
        <g fill="#131a24">
          <rect x="120" y="470" width="110" height="330"/><rect x="240" y="520" width="90" height="280"/>
          <rect x="350" y="420" width="130" height="380"/><rect x="500" y="560" width="100" height="240"/>
          <rect x="620" y="470" width="120" height="330"/><rect x="760" y="540" width="90" height="260"/>
          <rect x="870" y="440" width="150" height="360"/>
        </g>
        <g fill="${c}" opacity=".55">
          <rect x="150" y="510" width="16" height="20"/><rect x="190" y="510" width="16" height="20"/>
          <rect x="380" y="460" width="16" height="20"/><rect x="420" y="460" width="16" height="20"/>
          <rect x="650" y="510" width="16" height="20"/><rect x="690" y="510" width="16" height="20"/>
          <rect x="900" y="480" width="16" height="20"/><rect x="950" y="480" width="16" height="20"/>
        </g>`,
    3: `<rect x="180" y="120" width="560" height="560" rx="12" fill="#0f1a20" opacity=".55"/>
        <rect x="210" y="150" width="500" height="500" fill="${b}" opacity=".35"/>
        <circle cx="600" cy="260" r="46" fill="${c}" opacity=".8"/>
        <rect x="800" y="520" width="240" height="280" fill="#191510"/>
        <path d="M860 520 q-40 -90 10 -150 q50 60 20 150" fill="#3f6a4d"/>
        <path d="M900 520 q40 -70 90 -90 q-10 70 -50 90" fill="#4d7a58"/>
        <rect x="780" y="500" width="260" height="26" fill="#2c2118"/>`,
    4: `<circle cx="600" cy="300" r="90" fill="${c}" opacity=".55"/>
        <rect y="620" width="1200" height="280" fill="#152025"/>
        <path d="M0 640 q300 -40 600 0 q300 40 600 0 v80 H0z" fill="${b}" opacity=".5"/>
        <g fill="#10161a">
          <circle cx="470" cy="520" r="26"/><path d="M440 700 q0 -150 30 -150 q30 0 30 150z"/>
          <circle cx="720" cy="540" r="22"/><path d="M694 700 q0 -130 26 -130 q26 0 26 130z"/>
        </g>
        <g stroke="#f4d9b0" stroke-width="5" opacity=".6">
          <line x1="120" y1="600" x2="120" y2="760"/><line x1="120" y1="620" x2="1090" y2="620"/>
        </g>`,
    5: `<circle cx="600" cy="380" r="230" fill="${c}" opacity=".22"/>
        <circle cx="600" cy="360" r="120" fill="#14181d"/>
        <path d="M600 470 q150 0 190 250 H410 q40 -250 190 -250z" fill="#14181d"/>
        <path d="M520 300 q80 -90 160 0 q-80 -40 -160 0z" fill="${c}" opacity=".5"/>
        <circle cx="560" cy="350" r="7" fill="${c}"/><circle cx="640" cy="350" r="7" fill="${c}"/>`,
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" width="1200" height="900">
    <defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${a}"/><stop offset=".62" stop-color="${b}"/><stop offset="1" stop-color="${a}"/>
    </linearGradient></defs>
    <rect width="1200" height="900" fill="url(#s)"/>
    ${scenes[n] || scenes[1]}
  </svg>`;
}

/* --------------------------------- routes ---------------------------------- */

export function registerMedia(app, h) {
  ensureDir();

  app.get('/api/media', h.requireUser, (req, res) => {
    const me = req.user;
    const d = getDb();
    const kind = req.query.kind === 'reel' ? 'reel' : req.query.kind === 'photo' ? 'photo' : null;
    const scope = req.query.scope === 'mine' ? 'mine' : 'all';
    const rows = (d.media || [])
      .filter((m) => (kind ? m.kind === kind : true))
      .filter((m) => (scope === 'mine' ? m.ownerId === me.id : canSee(m, me, d)))
      .sort((a, b) => (a.at < b.at ? 1 : -1))
      .slice(0, 120)
      .map((m) => mediaView(m, me.id));
    res.json({ media: rows });
  });

  app.post('/api/media', h.requireUser, (req, res) => {
    const me = req.user;
    const d = getDb();
    const kind = req.body?.kind === 'reel' ? 'reel' : 'photo';
    const limits = LIMITS[kind];
    const dataUrl = String(req.body?.dataUrl || '');
    const match = dataUrl.match(/^data:([a-z0-9.+/-]+);base64,(.+)$/i);
    if (!match) return res.status(400).json({ error: 'Choose a file to upload.' });
    const mime = match[1].toLowerCase();
    if (!EXT[mime]) return res.status(400).json({ error: 'That file type is not supported.' });
    if (kind === 'photo' && !mime.startsWith('image/'))
      return res.status(400).json({ error: 'Photos need to be an image.' });
    if (kind === 'reel' && !mime.startsWith('video/'))
      return res.status(400).json({ error: 'Reels need to be a short video.' });

    const buf = Buffer.from(match[2], 'base64');
    if (buf.length > limits.maxBytes)
      return res.status(413).json({ error: `That is too big. Keep ${kind === 'reel' ? 'reels under 15 MB' : 'photos under 4 MB'}.` });

    const mine = (d.media || []).filter((m) => m.ownerId === me.id && m.kind === kind);
    if (mine.length >= limits.quota)
      return res.status(400).json({ error: `You have used all ${limits.quota} ${limits.label}. Delete one to make room.` });
    const used = (d.media || []).filter((m) => m.ownerId === me.id).reduce((n, m) => n + (m.bytes || 0), 0);
    if (used + buf.length > TOTAL_BYTES)
      return res.status(400).json({ error: 'Your storage is full. Delete a photo or reel to make room.' });

    const id = newId(kind === 'reel' ? 'v' : 'ph');
    const file = `${id}.${EXT[mime]}`;
    ensureDir();
    fs.writeFileSync(path.join(MEDIA_DIR, file), buf);

    const row = {
      id,
      ownerId: me.id,
      kind,
      file,
      mime,
      bytes: buf.length,
      caption: h.clean(req.body?.caption, 600),
      visibility: req.body?.visibility === 'circle' ? 'circle' : 'public',
      likes: [],
      comments: [],
      shares: 0,
      at: nowIso(),
    };
    if (!d.media) d.media = [];
    d.media.push(row);
    save();
    if (row.visibility === 'public') h.notifyCircle(me.id, 'system', `${me.name.split(' ')[0]} shared a new ${kind === 'reel' ? 'reel' : 'photo'}.`, id);
    res.status(201).json({ media: mediaView(row, me.id), used: used + buf.length, quota: limits.quota });
  });

  app.get('/api/media/file/:id', h.requireUser, (req, res) => {
    const me = req.user;
    const d = getDb();
    const m = (d.media || []).find((x) => x.id === req.params.id);
    if (!m) return res.status(404).send('Not found');
    if (!canSee(m, me, d)) return res.status(403).send('Private');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    if (m.seedArt) {
      res.type('image/svg+xml').send(seedArtSvg(m.seedArt));
      return;
    }
    const file = path.join(MEDIA_DIR, m.file || '');
    if (!file.startsWith(MEDIA_DIR) || !fs.existsSync(file)) return res.status(404).send('Missing');
    res.type(m.mime || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });

  app.post('/api/media/:id/like', h.requireUser, (req, res) => {
    const me = req.user;
    const m = (getDb().media || []).find((x) => x.id === req.params.id);
    if (!m) return res.status(404).json({ error: 'Not found.' });
    m.likes = m.likes || [];
    const i = m.likes.indexOf(me.id);
    if (i >= 0) m.likes.splice(i, 1);
    else {
      m.likes.push(me.id);
      if (m.ownerId !== me.id)
        h.notify(m.ownerId, 'like', `${me.name.split(' ')[0]} liked your ${m.kind === 'reel' ? 'reel' : 'photo'}.`, me.id, m.id);
    }
    save();
    res.json({ liked: i < 0, count: m.likes.length });
  });

  app.post('/api/media/:id/comment', h.requireUser, (req, res) => {
    const me = req.user;
    const d = getDb();
    const m = (d.media || []).find((x) => x.id === req.params.id);
    if (!m) return res.status(404).json({ error: 'Not found.' });
    if (!canSee(m, me, d)) return res.status(403).json({ error: 'That post is private.' });
    const body = h.clean(req.body?.body, 600);
    if (!body) return res.status(400).json({ error: 'Write a comment first.' });
    m.comments = m.comments || [];
    m.comments.push({ id: newId('c'), fromId: me.id, body, at: nowIso() });
    save();
    if (m.ownerId !== me.id)
      h.notify(m.ownerId, 'comment', `${me.name.split(' ')[0]} commented: “${body.slice(0, 60)}”`, me.id, m.id);
    res.status(201).json({ media: mediaView(m, me.id) });
  });

  app.post('/api/media/:id/share', h.requireUser, (req, res) => {
    const me = req.user;
    const m = (getDb().media || []).find((x) => x.id === req.params.id);
    if (!m) return res.status(404).json({ error: 'Not found.' });
    m.shares = (m.shares || 0) + 1;
    save();
    if (m.ownerId !== me.id) h.notify(m.ownerId, 'share', `${me.name.split(' ')[0]} shared your post.`, me.id, m.id);
    res.json({ shares: m.shares });
  });

  app.delete('/api/media/:id', h.requireUser, (req, res) => {
    const me = req.user;
    const d = getDb();
    const m = (d.media || []).find((x) => x.id === req.params.id && x.ownerId === me.id);
    if (!m) return res.status(404).json({ error: 'Not your post.' });
    if (m.file) {
      try {
        fs.unlinkSync(path.join(MEDIA_DIR, m.file));
      } catch {
        /* file already gone */
      }
    }
    d.media = d.media.filter((x) => x.id !== m.id);
    save();
    res.json({ ok: true });
  });

  app.get('/api/media/quota', h.requireUser, (req, res) => {
    const me = req.user;
    const mine = (getDb().media || []).filter((m) => m.ownerId === me.id);
    res.json({
      photos: mine.filter((m) => m.kind === 'photo').length,
      photoQuota: LIMITS.photo.quota,
      reels: mine.filter((m) => m.kind === 'reel').length,
      reelQuota: LIMITS.reel.quota,
      bytes: mine.reduce((n, m) => n + (m.bytes || 0), 0),
      byteQuota: TOTAL_BYTES,
    });
  });
}
