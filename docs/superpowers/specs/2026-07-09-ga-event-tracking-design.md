# Google Analytics Event Tracking — Design

## Context

GA4 pageview tracking is already wired up in `app/layout.tsx` via inline `gtag.js` script tags, driven by `NEXT_PUBLIC_GA_MEASUREMENT_ID`. This only reports pageviews, giving no insight into how users actually use the grid generator (which features get used, where users drop off, whether shares/downloads happen). This design adds custom GA4 events for the key interactions in the app to build an engagement funnel.

## Goals

- Track: grid generation (success/failure), grid sharing, grid↔JPG view toggling, Spotify link clicks.
- Keep implementation minimal and consistent with the existing `gtag.js` script-tag setup (no migration to `@next/third-parties`).
- Centralize event-firing through one small helper rather than scattering raw `window.gtag` calls.

## Non-goals

- Migrating the GA loading mechanism.
- Tracking the "Labels On/Off" toggle or the share-page's own copy-link button — these are minor UI state, not funnel-relevant, and are explicitly excluded to avoid event noise.
- Consent management / cookie banner — out of scope for this change (see Privacy Note below).

## Privacy Note

The `username` field entered by the user (a Last.fm username, not necessarily a real name but potentially identifying) will be sent as an event parameter on `generate_grid`, `share_grid`, and `spotify_link_click`. This is an explicit product decision (confirmed with stakeholder) to enable repeat-user analysis. Sending user-identifying data to Google Analytics typically requires disclosure in a privacy policy; if this site doesn't have one, that should be added separately (tracked as a follow-up, not part of this change).

## Design

### 1. Central events helper — `lib/analytics.ts` (new file)

```ts
export function trackEvent(name: string, params?: Record<string, string | number | boolean>) {
  if (typeof window === 'undefined' || !window.gtag) return;
  window.gtag('event', name, params);
}
```

Add an ambient type declaration (likely in this same file, or `lib/types.ts`) so `window.gtag` type-checks without `any`/`@ts-ignore`:

```ts
declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
  }
}
```

### 2. Call sites — all in `app/page.tsx`

| Event | Trigger location | Params |
|---|---|---|
| `generate_grid` | Success path inside `fetchTopAlbums`, after `setSharedId(responseData.sharedId)` (~line 279) | `username`, `time_range`, `grid_size` |
| `generate_grid_failed` | Catch/error path inside `fetchTopAlbums` | `time_range`, `error_reason` (e.g. `"user_not_found"`, `"api_error"`) |
| `share_grid` | Inside `handleShareGrid` (line 629) | `username`, `shared_id` |
| `view_toggle` | Inside `handleToggleView` (line 652) | `direction` (`"to_jpg"` \| `"to_grid"`) |
| `spotify_link_click` | New `onClick` handler added to the existing `<a href={currentSpotifyUrl}>` at line 988 | `username` |

`error_reason` values should map to the existing error branches already present in `fetchTopAlbums`'s catch/error handling — use whatever distinct failure cases that function already distinguishes (e.g. user-not-found vs. generic API failure); don't invent new error categories not already handled.

### 3. Testing

- Unit test `lib/analytics.ts`: `trackEvent` is a no-op when `window.gtag` is undefined (SSR/test environment), and calls `window.gtag('event', name, params)` when it's defined.
- No new tests needed for `app/page.tsx` call sites beyond ensuring existing tests still pass (mocking `window.gtag` as needed if it's undefined in jsdom and causes noise).

## Open questions

None — design approved by stakeholder.
