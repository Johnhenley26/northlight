# Northlight

**You're on the map. You're not alone.**

Northlight is a privacy-first web app for people experiencing homelessness: a spot your family can see, the
people who will answer, hot food and water, a bed tonight, a room of your own, news that connects you to the
world, games that pass an hour, and a written record of what you need — and what you want.

## Screens

| Screen | What it does |
| --- | --- |
| **Home** | A beacon you can switch off. Your spot and who can see it, active meal delivery, today's kitchens, your circle, wishes you could fill, stories, and quick links to news, games and success stories. |
| **My spot** | Share location with one switch, set by GPS, by checking in at a place, or by naming the area. Area-only rounding (~500 m), a last-known spot recorded even while sharing is off, and a per-person view of who sees what. |
| **Circle** | Message family and friends, search by name/handle/school/passion, accept requests one at a time, join by invite code, send love, remove or block someone, and see the social links they chose to share. |
| **Games** | Seven solo games — daily word, word guess, dominoes, blackjack, five-card draw, solitaire, Tetris — and three live two-player tables (dominoes, word duel, blackjack race) with server-checked moves. |
| **News** | Live world, US and local headlines for all 50 states, DC, Puerto Rico and the U.S. Virgin Islands, pulled from Google News RSS. |
| **Photos** | Up to 25 photos and 8 short reels per person, with captions, public-or-circle visibility, loves, comments, shares and deletion. Plus a longer-form blog. |
| **Success** | Stories from people who got out: what actually helped, what did not, likes and comments. Anonymous posting is allowed. |
| **Help** | Food, water, beds, showers, clinics, charging — open-today status, step-free access, directions, check-in, and free meal delivery to your spot. Free and subsidized paid residency. |
| **Me / Settings** | Profile, story, passions, needs/wants/goals/dreams/wishlist, and every privacy switch: sharing, detail level, who can request you, hiding your page, housing status, notifications, linked accounts, blocked list, data export and account deletion. |

## Safety

A red **SOS** button sits on every screen. It offers four alerts — local help, ambulance, police, Narcan — and
records where you last were. It **notifies the people in your circle** and puts 911, 988, the Never Use Alone
overdose line and Poison Control one tap away. It does **not** dispatch emergency services; the app says so
plainly in the confirmation. Alerts can be closed with “I am safe”.

## Privacy model

- Location is **off by default**. Only people you accepted into your circle can see a spot; nobody else, ever.
- Exact or area (~500 m) detail, your choice. Sharing off still keeps one last-known spot for you.
- Circle-only photos are served only to circle members — the file route enforces it server-side.
- No email, phone or ID. Sign-in is a handle plus a 4–8 digit PIN (scrypt hashed), with an HttpOnly session cookie.
- Blocking removes someone from your circle, ends pending requests, and hides you from each other's search,
  messages and posts.
- If you become housed you can keep your page, hide it from search, or turn it into a success story — and
  delete everything at any time.

## Run it

```bash
npm install
npm run dev        # helper script if present; otherwise run both:
npm run server     # API on :3001
npx vite --host 0.0.0.0 --port 3000   # client on :3000, proxying /api
npm run build && npm run typecheck
```

The preview hostname needs `NORTHLIGHT_ALLOWED_HOSTS=<host>` when starting Vite (see `vite.config.ts`).

### Demo account

Press **Enter as Maya** on the sign-in card, or use handle `maya`, PIN `1111`. Maya has unread family
messages, a delivery on the way, a residency application in review, needs and wishes, a notification feed, a
photo feed and open games. Seeded handles `ana` / `2222`, `devon` / `3333`, `tuck` / `4444`, `jules` / `5555`,
`roz` / `6666`, `alicia` / `7777`, `henry` / `8888` let you test from the other side.

## Publish to GitHub

One script does it:

```bash
./push-to-github.sh                # creates a public repo named "northlight"
./push-to-github.sh my-app --private
./push-to-github.sh --dry-run      # preview the file list, change nothing
```

It needs the [GitHub CLI](https://cli.github.com) signed in once (`gh auth login`). Without it, create an
empty repo on github.com and run the two `git remote add` / `git push` lines the script prints. Uploaded is
source only: `.gitignore` keeps `node_modules/`, `dist/`, `logs/`, `.env` and **`server/data/`** out of the
repository, so the demo database, uploaded photos and seeded accounts stay on your machine. A fresh clone
starts with a clean seed on first run.

## Stack

React 18 + TypeScript + Vite, Express, and a single JSON store (`server/data/db.json`) with atomic writes.
Photos and reels are files under `server/data/media` with metadata and quotas in the store. Online games are
server-authoritative; the daily puzzle and solo high scores live on the server too. News is fetched from
Google News RSS and cached for eight minutes.

## Honest limits

- **News** is real and live, but it is a headline reader: source, title, time and link. No article text.
- **Social links** store the handle you type and open the profile. There is no Facebook/Instagram OAuth and
  Northlight never posts on your behalf.
- **SOS** alerts your circle and shows real numbers; it cannot call 911 or dispatch anyone.
- **Delivery** is an in-app request and tracker, not a courier integration.
- **Games**: solo games run in the browser; online games use server-checked polling (about 2 s), not sockets.
  Bots are simple, and chips are pretend.
- **Photos/reels** are stored on the server disk for this prototype with per-person quotas (25 photos, 8
  reels, 140 MB). A production deployment wants object storage and a real database.
- Partner kitchens, shelters and housing operators are fictional; coordinates are real Portland locations so
  maps behave correctly. Seeded photos are generated illustrations, not real photographs.
