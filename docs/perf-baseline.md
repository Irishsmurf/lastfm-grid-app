# Performance Baseline

Captured before the performance overhaul, so every change can be measured rather than
assumed. Re-run each section after the work lands and record the "after" column.

Commit at time of capture: `ac2eefa` (branch `claude/web-app-performance-tuning-3cicam`).

---

## 1. Build / bundle size

Captured with `npm run build` on Node v22.22.2.

| Route            | Route size | First Load JS |
| ---------------- | ---------- | ------------- |
| `/`              | 32.7 kB    | **168 kB**    |
| `/share/[id]`    | 6.71 kB    | 125 kB        |
| `/about`         | 5.13 kB    | 109 kB        |
| `/_not-found`    | 977 B      | 104 kB        |
| API routes (`ƒ`) | 155 B      | 104 kB        |

Shared by all: **103 kB**

- `chunks/4bd1b696-*.js` — 53.2 kB
- `chunks/721-*.js` — 48.3 kB
- other shared — 1.93 kB

`/` is the target: 168 kB First Load JS for a page that renders nine images.

## 2. Test suite

`npm test` → **13 suites, 58 tests, all passing** in ~18.6 s. This is the regression gate;
it must stay green through every phase.

## 3. Observed during build — eager Redis connection

The static build emits a continuous stream of:

```
{"context":"Redis","msg":"Connection error: connect ECONNREFUSED 127.0.0.1:6379"}
{"context":"Redis","msg":"Reconnecting to Redis..."}
```

across at least four separate PIDs. `lib/redis.ts:4` constructs `new Redis(...)` at module
scope with no `lazyConnect`, so _every_ process that imports the module — including
build-time static generation workers that never issue a command — opens a socket and enters
a reconnect loop. On Vercel this is one connection per lambda instance, opened at cold start
whether or not the request needs Redis. This is the concrete scale-out ceiling.

---

## 4. Dead weight confirmed by inspection

These cost real time at runtime and produce nothing. Verified, not inferred.

**The album-art brightness analysis is entirely dead.** Two implementations exist —
`app/page.tsx:493-543` (64×64 sample, ~4k iterations) and
`app/share/[id]/SharePageClient.tsx:28-71`, which sets `canvas.width = img.width` and loops
**every pixel at full resolution**: ~90,000 iterations per album, ~810,000 for a 9-tile grid,
synchronously on the main thread inside `img.onload`. Each also forces a second full-size
download of every album image (`crossOrigin='anonymous'` on the raw Last.fm URL, a different
cache entry from `next/image`'s `/_next/image?url=…`).

All of that feeds one decision: `.spotify-logo-light-bg` vs `.spotify-logo-dark-bg`
(`app/globals.css:119-125`), which set **only `color`**. The logo renders as
`<Image src="/spotify_icon.svg">` — an `<img>` tag. An SVG loaded through `<img>` is an
isolated document and cannot inherit `color` from the parent page, so the `fill="currentColor"`
in the SVG resolves against its own root and stays black. The third class applied at
`app/page.tsx:1008`, `.spotify-icon-overlay`, has **no rule defined anywhere**.

Net: the logo is black on every tile today. Deleting the analysis preserves current behaviour
exactly. (If the adaptive logo is actually wanted, it needs the SVG inlined as a React
component so `currentColor` resolves — a separate feature, not a perf task.)

**Other confirmed dead/broken code:**

- `/api/placeholder/300/300` — referenced at `app/page.tsx:360`, `app/page.tsx:982`, and
  `SharePageClient.tsx:315`. **No such route exists**; every album with an empty `imageUrl`
  404s through the image optimizer.
- `spotifyLinkCount` (`lib/metrics.ts:85-89`) — declared, never incremented anywhere.
- `app/about/page.tsx` uses `next/head`, which is a **no-op in the App Router**. The entire
  `<Head>` block emits nothing; the page ships with no title, description, or OG tags.
- `utils/logger.ts` (pino, a server logger) is imported into the client component
  `SharePageClient.tsx:9` and ships to the browser.
- `.husky/pre-push` — every line is commented out; the hook does nothing.
- `components/RemoteConfigInitializer.tsx` — zero imports outside its own test.

**Correction to an earlier estimate:** first paint costs **2** fetches per tile, not 3
(`next/image` + the brightness analyser). `generateImage()`'s third fetch only runs when the
user clicks "Convert to JPG", and usually hits browser cache.

## 5. Runtime measurements — method (requires deploy + credentials)

These need a real Redis, real Last.fm/Spotify keys, and a deployed origin, none of which
exist in the dev container. Capture them against production (or a preview deploy) before
merging, and record the numbers here.

### 5a. Lighthouse (mobile, throttled)

```bash
npx lighthouse https://lastfm.paddez.com/ \
  --preset=desktop --output=json --output-path=./lh-home-before.json
npx lighthouse "https://lastfm.paddez.com/share/<known-id>" \
  --output=json --output-path=./lh-share-before.json
```

Record: LCP, TBT, CLS, TTI, total JS transferred.

| Metric         | `/` before | `/` after | `/share/[id]` before | `/share/[id]` after |
| -------------- | ---------- | --------- | -------------------- | ------------------- |
| LCP            |            |           |                      |                     |
| TBT            |            |           |                      |                     |
| CLS            |            |           |                      |                     |
| JS transferred |            |           |                      |                     |

### 5b. Request waterfall

DevTools → Network, hard reload, generate a 5×5 grid. Record:

- total request count
- number of `/api/spotify-link` calls (expect **25** before, **0** after)
- number of album-art fetches (expect up to **75** before — 3 per tile — and **25** after)
- total image bytes transferred

### 5c. Origin latency

```bash
npx autocannon -c 50 -d 30 \
  "https://lastfm.paddez.com/api/albums?username=<known>&period=1month&limit=9"
```

Run twice: once against a cold cache key, once warm. Record p50 / p95 / p99 and req/s.

### 5d. CDN offload

```bash
curl -sI "https://lastfm.paddez.com/api/albums?username=<known>&period=1month&limit=9" \
  | grep -i x-vercel-cache
```

Before: expect no `Cache-Control`, so every call is a `MISS` and reaches a lambda.
After: expect `MISS` then `HIT` on the second identical call, with no second invocation in
the Vercel function logs.

### 5e. Redis write amplification

```bash
redis-cli DBSIZE
redis-cli --scan --pattern 'share:*' | wc -l
redis-cli INFO memory | grep used_memory_human
```

Take a reading, generate the **same** grid 20 times, take another. Before the fix the
`share:*` count grows by 20 (one permanent key per request). After, it must not move —
share records are only written when a user actually clicks Share.
