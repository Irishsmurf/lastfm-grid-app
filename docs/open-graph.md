# Open Graph Protocol Implementation

## Goal

Add meaningful OG metadata to two surfaces:

1. **Main app** (`/`) — static branded OG image with app name/description
2. **Share page** (`/share/[id]`) — dynamic OG image and metadata reflecting the specific user's album grid

---

## Current State

- `app/layout.tsx` exports a `metadata` object with basic OG fields, but the image points to `/globe.svg` — not useful for social sharing.
- `app/share/[id]/page.tsx` is `'use client'`, so it **cannot** export `generateMetadata` or a file-based `opengraph-image`. All data is fetched client-side, meaning crawlers see no meaningful metadata.

---

## Architecture

### Main Page OG Image

**File:** `app/opengraph-image.tsx`

Next.js 15 App Router supports [file-based OG image generation](https://nextjs.org/docs/app/api-reference/file-conventions/opengraph-image) using `ImageResponse` from `next/og`. Creating this file at the route segment level causes Next.js to automatically serve it at `/opengraph-image` and wire it into the `<meta>` tags.

The image will be a static 1200×630 branded card:

- App name: "LastFM Album Collage Generator"
- Tagline: "Generate an image of your top albums"
- Black background with white text (matches app theme)

**Update `app/layout.tsx`:** Remove the hardcoded `images` array from the OG block — Next.js infers it from `opengraph-image.tsx` automatically.

---

### Share Page OG

#### Problem

The share page must:

1. Serve dynamic `<meta og:*>` tags per share ID (for crawlers/unfurlers)
2. Render a dynamic OG image showing the 3×3 album grid

Both require server-side data access, but the current page is entirely client-rendered.

#### Solution: Server Component Wrapper + Client Component Split

**`app/share/[id]/page.tsx`** — convert to a **server component**:

- Exports `generateMetadata(props)` that fetches `SharedGridData` from Redis directly and returns per-share OG metadata
- Renders `<SharePageClient id={id} />` for the interactive UI

**`app/share/[id]/SharePageClient.tsx`** — new file:

- Move the entire existing `'use client'` component here (no logic changes)

**`app/share/[id]/opengraph-image.tsx`** — dynamic OG image:

- Next.js calls this at build/request time with the route params
- Fetches `SharedGridData` from Redis
- Renders a 1200×630 `ImageResponse` layout:
  - Left (630×630): 3×3 grid of album art images (each 210×210)
  - Right (570×630): username, period label, app branding
- Falls back gracefully if the share is not found (renders the static branded image)

#### Data Access in Server Context

Both `generateMetadata` and `opengraph-image.tsx` import `redis` from `lib/redis` directly — same pattern used in `app/api/share/[id]/route.ts`. This avoids HTTP round-trips and works in Node.js runtime (default for App Router pages).

---

## File Manifest

| File                                 | Action  | Purpose                                  |
| ------------------------------------ | ------- | ---------------------------------------- |
| `docs/open-graph.md`                 | Create  | This planning document                   |
| `app/opengraph-image.tsx`            | Create  | Static OG image for main page            |
| `app/layout.tsx`                     | Update  | Remove hardcoded OG `images` array       |
| `app/share/[id]/SharePageClient.tsx` | Create  | Client component (moved from page.tsx)   |
| `app/share/[id]/page.tsx`            | Rewrite | Server component with `generateMetadata` |
| `app/share/[id]/opengraph-image.tsx` | Create  | Dynamic OG image for share pages         |

---

## OG Metadata per Surface

### Main Page (`/`)

```
og:title       = "LastFM Album Collage Generator"
og:description = "Generate an image of your top albums!"
og:type        = "website"
og:url         = "https://lastfm.paddez.com"
og:image       = /opengraph-image (auto-inferred by Next.js)
```

### Share Page (`/share/[id]`)

```
og:title       = "{username}'s {period} album grid"
og:description = "Top albums: {album1}, {album2}, {album3}..."
og:type        = "website"
og:url         = "https://lastfm.paddez.com/share/{id}"
og:image       = /share/{id}/opengraph-image (auto-inferred)
```

Period labels map the Last.fm API keys to human-readable strings:

- `7day` → "Last Week"
- `1month` → "Last Month"
- `3month` → "Last 3 Months"
- `6month` → "Last 6 Months"
- `12month` → "Last Year"
- `overall` → "Overall"

---

## Constraints & Notes

- `ImageResponse` (next/og) supports only a **subset of CSS**: flexbox, basic box model, text, and `object-fit`. No CSS Grid — the 3×3 layout uses `flex-wrap`.
- Album art images are fetched from Last.fm CDN (`*.last.fm` URLs). These are external, so they must be configured in `next.config.js` `images.remotePatterns` — already done for the `<Image>` component, but `ImageResponse` fetches them at the HTTP level (not using Next.js Image), so no additional config is needed.
- The `opengraph-image.tsx` route is statically typed by Next.js — it exports `alt`, `size`, `contentType`, and a default `async function Image({ params })`.
- If Redis is unavailable or the share ID doesn't exist, `generateMetadata` returns generic fallback metadata and `opengraph-image.tsx` renders the static branded image.
