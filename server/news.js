// Live news via Google News RSS, cached in memory. No API key, no scraping of
// article bodies — headline, source, link and timestamp only.
const STATES = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'], ['CA', 'California'],
  ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'], ['FL', 'Florida'], ['GA', 'Georgia'],
  ['HI', 'Hawaii'], ['ID', 'Idaho'], ['IL', 'Illinois'], ['IN', 'Indiana'], ['IA', 'Iowa'],
  ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['ME', 'Maine'], ['MD', 'Maryland'],
  ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'], ['MS', 'Mississippi'], ['MO', 'Missouri'],
  ['MT', 'Montana'], ['NE', 'Nebraska'], ['NV', 'Nevada'], ['NH', 'New Hampshire'], ['NJ', 'New Jersey'],
  ['NM', 'New Mexico'], ['NY', 'New York'], ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'],
  ['OK', 'Oklahoma'], ['OR', 'Oregon'], ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'],
  ['SD', 'South Dakota'], ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'], ['VT', 'Vermont'],
  ['VA', 'Virginia'], ['WA', 'Washington'], ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming'],
  ['DC', 'District of Columbia'], ['PR', 'Puerto Rico'], ['VI', 'U.S. Virgin Islands'],
];

const NAME = new Map(STATES);
const cache = new Map();
const TTL = 8 * 60 * 1000;

const decode = (s) =>
  String(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function parseRss(xml, limit = 12) {
  const blocks = [...String(xml).matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);
  const items = [];
  for (const block of blocks) {
    const grab = (tag) => {
      const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
      return m ? decode(m[1]) : '';
    };
    const title = grab('title');
    const url = grab('link');
    if (!title || !url) continue;
    const source = grab('source') || 'Google News';
    const pub = grab('pubDate');
    const at = pub && !Number.isNaN(Date.parse(pub)) ? new Date(pub).toISOString() : new Date().toISOString();
    const summary = grab('description').slice(0, 220);
    items.push({ title, url, source, at, summary });
    if (items.length >= limit) break;
  }
  return items;
}

function feedUrl(scope, state) {
  if (scope === 'world')
    return 'https://news.google.com/rss/headlines/section/topic/WORLD?hl=en-US&gl=US&ceid=US:en';
  if (scope === 'us')
    return 'https://news.google.com/rss/headlines/section/topic/NATION?hl=en-US&gl=US&ceid=US:en';
  const name = NAME.get(state) || state;
  const q = encodeURIComponent(`"${name}" local news`);
  return `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`;
}

export async function getNews(scope, state) {
  const safeScope = scope === 'state' ? 'state' : scope === 'us' ? 'us' : 'world';
  const code = safeScope === 'state' ? (NAME.has(state) ? state : 'OR') : '';
  const key = `${safeScope}:${code}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return { ...hit.value, cached: true };

  try {
    const res = await fetch(feedUrl(safeScope, code), {
      headers: { 'User-Agent': 'Northlight/1.0 (community news reader)' },
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) throw new Error(`feed responded ${res.status}`);
    const xml = await res.text();
    const items = parseRss(xml);
    if (!items.length) throw new Error('feed had no items');
    const value = {
      scope: safeScope,
      state: code || null,
      stateName: code ? NAME.get(code) : null,
      items,
      fetchedAt: new Date().toISOString(),
      live: true,
    };
    cache.set(key, { at: Date.now(), value });
    if (cache.size > 80) cache.delete(cache.keys().next().value);
    return { ...value, cached: false };
  } catch (err) {
    if (hit) return { ...hit.value, cached: true, stale: true };
    return {
      scope: safeScope,
      state: code || null,
      stateName: code ? NAME.get(code) : null,
      items: [],
      fetchedAt: new Date().toISOString(),
      live: false,
      error: 'Live headlines are unreachable right now. This is a connection problem, not a quiet news day.',
    };
  }
}

export function registerNews(app, h) {
  app.get('/api/news/states', h.requireUser, (_req, res) => {
    res.json({ states: STATES.map(([code, name]) => ({ code, name })) });
  });

  app.get('/api/news', h.requireUser, async (req, res) => {
    const scope = String(req.query.scope || 'world');
    const state = String(req.query.state || 'OR').toUpperCase();
    const payload = await getNews(scope, state);
    res.json(payload);
  });
}
