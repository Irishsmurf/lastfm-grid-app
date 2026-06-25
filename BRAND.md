# Brand Guidelines — LastFM Album Collage Generator

## Name

**LastFM Album Collage** — used in full in headings and OG images.  
**LFM Grid** — short form for the PWA manifest `short_name` and constrained contexts.  
**lastfm.paddez.com** — canonical domain, displayed in brand red in OG images.

---

## Logo

`/public/logo.svg` — a 3×3 album-art grid where three cells are highlighted in brand red (top-right, centre, bottom-left), forming a diagonal accent pattern. The icon sits on a near-black background rounded rectangle.

### Sizes

| File                             | Usage                            |
| -------------------------------- | -------------------------------- |
| `/public/logo.svg`               | Inline SVG, scalable             |
| `/public/icons/icon-192x192.png` | PWA manifest, Android homescreen |
| `/public/icons/icon-512x512.png` | PWA manifest splash, app stores  |

### Clear space

Maintain a minimum clear space of ½ the icon's height on all sides.

---

## Colour Palette

| Token             | Hex       | Usage                                            |
| ----------------- | --------- | ------------------------------------------------ |
| `brand-red`       | `#d51007` | Primary accent, CTA highlights, brand marker     |
| `brand-red-dark`  | `#a80c05` | Hover state for red elements                     |
| `brand-red-light` | `#ff2a1f` | Focus ring or light-mode accent variant          |
| `brand-dark`      | `#0f0f0f` | OG image background, dark surfaces               |
| `brand-surface`   | `#1a1a1a` | Cards on dark background, grid cell placeholders |
| `brand-success`   | `#22c55e` | Confirmation states (e.g. "Copied!" checkmark)   |

Tokens are wired into `tailwind.config.ts` under the `brand.*` namespace and can be used as `bg-brand-red`, `text-brand-red`, etc.

The light/dark mode UI uses shadcn/ui CSS variables (`--background`, `--foreground`, etc.) defined in `app/globals.css` and are separate from the brand palette above.

---

## Typography

| Role             | Font       | Weight  | Tailwind class                          |
| ---------------- | ---------- | ------- | --------------------------------------- |
| Headings (h1–h6) | Montserrat | 700     | `font-montserrat` / `--font-montserrat` |
| Body & UI        | Inter      | 400–600 | `font-inter` / `--font-inter`           |
| Captions / meta  | Inter      | 400     | `text-sm text-muted-foreground`         |

Both fonts are loaded via `next/font/google` in `app/layout.tsx` and applied globally in `app/globals.css`.

### Type scale (Tailwind defaults)

- Display / hero: `text-4xl font-bold` (Montserrat)
- Section heading: `text-2xl font-semibold` (Montserrat)
- Body: `text-base` (Inter)
- Caption / label: `text-sm` (Inter)
- Badge / allcaps: `text-xs font-semibold tracking-widest uppercase` (Inter)

---

## Tone of Voice

- **Direct** — tell users exactly what to do: "Enter your Last.fm username"
- **Enthusiastic but brief** — celebrate the output, don't oversell the tool
- **Inclusive** — avoid jargon; "plays" not "scrobbles" in overlay UI
- **No marketing fluff** — error messages explain what happened, not what the brand aspires to

---

## OG Images

| File                                 | Dimensions | When used                             |
| ------------------------------------ | ---------- | ------------------------------------- |
| `app/opengraph-image.tsx`            | 1200×630   | Default / homepage                    |
| `app/share/[id]/opengraph-image.tsx` | 1200×630   | Per-share URLs (shows real album art) |

Both use `BRAND_DARK` (#0f0f0f) background, white headings, `#aaaaaa` subtext, and `BRAND_RED` for the brand marker.

---

## Don'ts

- Don't use the logo on a coloured background other than near-black or white.
- Don't stretch or recolour the red diagonal accent pattern.
- Don't use "Last.fm" as if it's our brand — we are a third-party tool.
- Don't change the font for body text; Inter is chosen for legibility at small sizes on album tiles.
