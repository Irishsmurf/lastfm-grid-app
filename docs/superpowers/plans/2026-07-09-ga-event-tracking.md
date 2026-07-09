# GA Custom Event Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add GA4 custom events (`generate_grid`, `generate_grid_failed`, `share_grid`, `view_toggle`, `spotify_link_click`) to `app/page.tsx` so the existing pageview-only GA setup also captures the engagement funnel.

**Architecture:** A single new helper file `lib/analytics.ts` exports `trackEvent(name, params)`, a thin wrapper around `window.gtag('event', ...)` that no-ops when `gtag` isn't present (SSR, tests, ad-blockers). `app/page.tsx` imports `trackEvent` and calls it at five specific points inside existing handlers — no new UI, no new state.

**Tech Stack:** Next.js 15 App Router, TypeScript, Jest + ts-jest + `@testing-library/react`, existing inline `gtag.js` script in `app/layout.tsx`.

## Global Constraints

- Keep the existing `gtag.js` script-tag approach — do not migrate to `@next/third-parties` (per spec).
- Do not track the "Labels On/Off" toggle or the share-page copy-link button (per spec — explicitly out of scope).
- `username` is intentionally sent as an event parameter on `generate_grid`, `share_grid`, and `spotify_link_click` — this is an approved, deliberate product decision (see spec's Privacy Note), not an oversight to "fix" during implementation.
- Follow existing code patterns in `app/page.tsx` (function-based handlers, no new abstractions beyond the one helper file).

---

### Task 1: `trackEvent` helper with SSR/no-gtag safety

**Files:**
- Create: `lib/analytics.ts`
- Test: `lib/analytics.test.ts`

**Interfaces:**
- Produces: `trackEvent(name: string, params?: Record<string, string | number | boolean>): void` — imported by `app/page.tsx` in Task 2 onward.

- [ ] **Step 1: Write the failing tests**

Create `lib/analytics.test.ts`:

```ts
import { trackEvent } from './analytics';

describe('trackEvent', () => {
  const originalGtag = window.gtag;

  afterEach(() => {
    window.gtag = originalGtag;
  });

  it('does nothing when window.gtag is undefined', () => {
    // @ts-expect-error deliberately clearing gtag for this test
    delete window.gtag;
    expect(() => trackEvent('generate_grid', { username: 'rj' })).not.toThrow();
  });

  it('calls window.gtag with the event name and params when gtag exists', () => {
    const gtagMock = jest.fn();
    window.gtag = gtagMock;

    trackEvent('generate_grid', { username: 'rj', time_range: 'overall', grid_size: 9 });

    expect(gtagMock).toHaveBeenCalledWith('event', 'generate_grid', {
      username: 'rj',
      time_range: 'overall',
      grid_size: 9,
    });
  });

  it('calls window.gtag with no params object when none is passed', () => {
    const gtagMock = jest.fn();
    window.gtag = gtagMock;

    trackEvent('view_toggle_test_noop');

    expect(gtagMock).toHaveBeenCalledWith('event', 'view_toggle_test_noop', undefined);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --testPathPattern=lib/analytics.test.ts`
Expected: FAIL — `Cannot find module './analytics'` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `lib/analytics.ts`:

```ts
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackEvent(
  name: string,
  params?: Record<string, string | number | boolean>
): void {
  if (typeof window === 'undefined' || !window.gtag) return;
  window.gtag('event', name, params);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --testPathPattern=lib/analytics.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/analytics.ts lib/analytics.test.ts
git commit -m "feat: add trackEvent GA helper"
```

---

### Task 2: `generate_grid` and `generate_grid_failed` events in `fetchTopAlbums`

**Files:**
- Modify: `app/page.tsx:219-315` (the `fetchTopAlbums` function)

**Interfaces:**
- Consumes: `trackEvent(name: string, params?: Record<string, string | number | boolean>): void` from `lib/analytics.ts` (Task 1).

**Context:** `fetchTopAlbums` (app/page.tsx:219) reads `username` (string) and `timeRange` (string) and `gridSize` (`9 | 16 | 25`) from component state (already in scope in this function — see `app/page.tsx:246`). On success, `responseData.sharedId` is set via `setSharedId(responseData.sharedId)` at line 279. On failure, the `catch` block at line 301 sets `error` from `err.message` when `err instanceof Error`.

- [ ] **Step 1: Add the import**

At the top of `app/page.tsx`, alongside the other local imports, add:

```ts
import { trackEvent } from '@/lib/analytics';
```

(Match whatever import alias style — `@/lib/...` vs relative — the file already uses for other `lib/` imports; check an existing `from '@/lib/...'` or `from '../lib/...'` line and mirror it exactly.)

- [ ] **Step 2: Fire `generate_grid` on success**

In `fetchTopAlbums`, immediately after the `if (typeof responseData.sharedId === 'string') { setSharedId(responseData.sharedId); }` branch (app/page.tsx:278-279), add the event call inside that same `if` block:

```ts
        if (typeof responseData.sharedId === 'string') {
          setSharedId(responseData.sharedId);
          trackEvent('generate_grid', {
            username,
            time_range: timeRange,
            grid_size: gridSize,
          });
        } else if (responseData.sharedId === null && responseData.error) {
```

- [ ] **Step 3: Fire `generate_grid_failed` on error**

In the `catch (err: Error | unknown)` block (app/page.tsx:301-310), add the event call right after the existing `if (err instanceof Error) { ... } else { ... }` branch, before `setSharedId(null)`:

```ts
    } catch (err: Error | unknown) {
      console.error('An error occurred: ', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred. Please check the console.');
        console.error('Unknown error details:', err);
      }
      trackEvent('generate_grid_failed', {
        time_range: timeRange,
        error_reason: err instanceof Error ? err.message : 'unknown_error',
      });
      setSharedId(null); // Ensure sharedId is reset on error
      setAlbums([]); // Clear albums on error
```

- [ ] **Step 4: Manual verification (no automated test — see Task 6 for why)**

Run: `npm run dev`
In the browser, open DevTools → Network tab, filter on `google-analytics` or `collect`. Enter a valid Last.fm username and generate a grid — confirm a `generate_grid` beacon fires. Enter an invalid/nonexistent username and generate a grid — confirm a `generate_grid_failed` beacon fires.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx
git commit -m "feat: track generate_grid and generate_grid_failed GA events"
```

---

### Task 3: `share_grid` event in `handleShareGrid`

**Files:**
- Modify: `app/page.tsx:629-647` (the `handleShareGrid` function)

**Interfaces:**
- Consumes: `trackEvent` from `lib/analytics.ts` (Task 1, already imported in Task 2).

**Context:** `handleShareGrid` (app/page.tsx:629) reads `sharedId` and `username` from component state, and copies a share URL to the clipboard via `navigator.clipboard.writeText(url).then(...)`.

- [ ] **Step 1: Fire `share_grid` after a successful copy**

Modify the `.then()` callback at app/page.tsx:637-642:

```ts
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setShareCopied(true);
        trackEvent('share_grid', { username, shared_id: sharedId });
        setTimeout(() => {
          setShareCopied(false);
        }, 2000); // Reset after 2 seconds
      })
```

- [ ] **Step 2: Manual verification**

Run: `npm run dev`. Generate a grid, click the "Share" button, confirm (via DevTools Network tab, filter `collect`) a `share_grid` beacon fires with `shared_id` matching the current share URL.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: track share_grid GA event"
```

---

### Task 4: `view_toggle` event in `handleToggleView`

**Files:**
- Modify: `app/page.tsx:652-698` (the `handleToggleView` function)

**Interfaces:**
- Consumes: `trackEvent` from `lib/analytics.ts` (Task 1).

**Context:** `handleToggleView` (app/page.tsx:652) branches on the current `isJpgView` boolean: if true, it animates back to grid view (`setIsJpgView(false)`); if false, it generates the JPG and animates into JPG view (`setIsJpgView(true)`). The direction is known at the top of the function, before any state changes.

- [ ] **Step 1: Fire `view_toggle` at the start of the function, direction based on current `isJpgView`**

Modify app/page.tsx:652-653:

```ts
  const handleToggleView = () => {
    if (viewPhase !== 'idle' || isPreparingJpg) return;

    trackEvent('view_toggle', { direction: isJpgView ? 'to_grid' : 'to_jpg' });

    const reduceMotion = window.matchMedia(
```

- [ ] **Step 2: Manual verification**

Run: `npm run dev`. Generate a grid, click the Grid⇄JPG toggle button in both directions, confirm two `view_toggle` beacons fire with `direction: "to_jpg"` then `direction: "to_grid"`.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: track view_toggle GA event"
```

---

### Task 5: `spotify_link_click` event on the Spotify overlay link

**Files:**
- Modify: `app/page.tsx:987-999` (the Spotify `<a>` overlay)

**Interfaces:**
- Consumes: `trackEvent` from `lib/analytics.ts` (Task 1).

**Context:** The Spotify link (app/page.tsx:988-993) is a plain anchor with `href={currentSpotifyUrl}`, `target="_blank"`, no `onClick` yet. `username` is already in scope in this render (component state).

- [ ] **Step 1: Add an `onClick` handler to the anchor**

```tsx
                          {currentSpotifyUrl && (
                            <a
                              href={currentSpotifyUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => trackEvent('spotify_link_click', { username })}
                              className={`absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 spotify-icon-overlay ${logoBgType === 'light' ? 'spotify-logo-light-bg' : 'spotify-logo-dark-bg'}`}
                            >
```

- [ ] **Step 2: Manual verification**

Run: `npm run dev`. Generate a grid, hover an album cover to reveal the Spotify overlay, click it, confirm a `spotify_link_click` beacon fires (the link opening in a new tab doesn't interrupt the beacon since it's a normal anchor navigation, not a full page unload of the current tab).

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: track spotify_link_click GA event"
```

---

### Task 6: Full test suite regression check

**Files:** None modified — verification only.

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: All existing tests still PASS. `app/page.tsx` has no direct unit tests exercising `fetchTopAlbums`/`handleShareGrid`/`handleToggleView` end-to-end with a real `gtag`, so no existing test should need mocking — `trackEvent`'s no-op guard (Task 1) means calls are safe under jsdom, which doesn't define `window.gtag` by default. If any test unexpectedly fails referencing `gtag` or `trackEvent`, investigate before proceeding — do not silence by mocking blindly.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No new errors introduced by the changes in Tasks 2-5.

- [ ] **Step 3: Commit (only if Steps 1-2 required fixes)**

```bash
git add -A
git commit -m "fix: address lint/test regressions from GA event tracking"
```

(Skip this commit entirely if Steps 1-2 passed clean with no changes needed.)
