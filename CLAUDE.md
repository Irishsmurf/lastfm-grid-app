# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start development server (PWA disabled in dev)
npm run build        # Production build
npm run lint         # ESLint via Next.js
npm run lint:fix     # Auto-fix lint issues
npm run format       # Prettier formatting
npm test             # Run all Jest tests
npm test -- --testPathPattern=<file>  # Run a single test file
```

## Architecture

This is a **Next.js 15 App Router** application (deployed at lastfm.paddez.com) that generates 3×3 album art grids from Last.fm listening history.

### Request Flow

1. User submits username + period → `GET /api/albums` → `lib/lastfmService.ts` fetches Last.fm API → `lib/minimizedLastfmService.ts` transforms response → cached in Redis → returned with a nanoid-generated `sharedId`
2. Client-side: for each album, `GET /api/spotify-link` fetches Spotify API → cached in Redis
3. Shared grids are stored in Redis under `share:<nanoid>` and retrieved via `GET /api/share/[id]`

### Key Directories

- `app/` — Next.js pages and API routes (App Router)
- `app/api/albums/` — Top albums endpoint (validates input, uses `handleCaching`, saves shared grid)
- `app/api/spotify-link/` — Spotify link lookup per album
- `app/api/share/[id]/` — Retrieves stored shared grid from Redis
- `app/api/metrics/` — Prometheus metrics endpoint
- `app/share/[id]/` — Public share page
- `lib/` — Service modules and utilities
- `components/ui/` — shadcn/ui components (Radix UI + Tailwind)
- `utils/logger.ts` — Pino-based structured logger used server-side

### Core Patterns

**Caching**: All external API calls go through `lib/cache.ts`'s `handleCaching<T>()`. It checks Redis first, falls back to the `fetchDataFunction`, and handles "not found" scenarios with a `NOT_FOUND_PLACEHOLDER` sentinel value and shorter TTL.

**Feature Flags**: Firebase Remote Config via `lib/firebase.ts`. Defaults live in `defaultRemoteConfig`. The `RemoteConfigProvider` context (`lib/remoteConfigContext.tsx`) wraps the app. Client components call `useRemoteConfig()` or `getRemoteConfigValue()`. Cache expiry durations and FTUE (first-time user experience) behavior are all remote-configurable. Add new flags by: (1) updating `defaultRemoteConfig` in `lib/firebase.ts`, (2) publishing in Firebase Console.

**Data transformation**: Raw Last.fm API response → `transformLastFmResponse()` in `lib/minimizedLastfmService.ts` → `MinimizedAlbum[]` (strips down to name, artist, imageUrl, mbid, playcount). `SharedGridData` in `lib/types.ts` wraps this for shareable grids.

**Logging**: Server-side code uses `logger` from `utils/logger.ts` (Pino). Call as `logger.info('ContextName', 'message')`.

**Metrics**: `lib/metrics.ts` exports Prometheus counters/histograms (prom-client). The albums API route increments these and exposed via `/api/metrics`.

### Testing

Tests use Jest + ts-jest + `@testing-library/react` with jsdom. Firebase and Redis are mocked in tests. Test files colocate with source (`*.test.ts` / `*.test.tsx`). The `lucide-react` package is excluded from `transformIgnorePatterns` so it gets transpiled.

### Environment Variables

Required in `.env.local`:
- `LASTFM_API_KEY`, `LASTFM_BASE_URL`
- `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`
- `REDIS_URL`
- `NEXT_PUBLIC_GA_MEASUREMENT_ID`
- `NEXT_PUBLIC_FIREBASE_*` (API key, auth domain, project ID, storage bucket, messaging sender ID, app ID)
