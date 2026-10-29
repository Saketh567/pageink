# Decisions

One line each; full reasoning is in PLAN.md section 2.

- D1 URL import: tiered pipeline, `/api/fetch` then `/api/render` (headless) if the page is empty; frozen sanitized snapshot in a script-less sandboxed iframe.
- D2 Cut: share-sheet import, MHTML, screenshot-only capture.
- D3 Freeze `layoutWidth` per page (default 1280) and scale with a CSS transform.
- D4 Anchoring is hybrid: page coords + CSS selector for ink, TextQuote/Position for highlights, element then quote then point for notes.
- D5 Committed ink is SVG; the live stroke is a viewport-sized canvas.
- D6 Stroke geometry: perfect-freehand.
- D7 Stack: Vite + TypeScript + Preact (+signals); vanilla TS for ink/viewer/anchoring; idb, dompurify, vite-plugin-pwa, Vitest, Playwright.
- D8 Local storage: IndexedDB, plus backup to Files and `navigator.storage.persist()`.
- D9 Cloud: Vercel Blob for read-only shares and exports; Supabase only for live boards (Phase 9).
- D10 Proxy abuse: personal `APP_KEY` bearer token, SSRF guard with pinned DNS, size and time caps.
- D11 Export: client print to PDF and standalone HTML in the MVP; server Chromium in V1.
- D12 Handwriting: Scribble in note fields; Claude vision for lasso ink-to-text.
- D13 AI: Anthropic Messages API via `/api/explain`, key only in a Vercel env var.
- D14 Private GitHub repo under the personal account.

## Log

- P0.3: `vercel.json` omits the `api/render.ts` function entry until P2.5 creates the file (Vercel rejects patterns that match nothing).
- P1.4 input routing: chose **Option A** (touch-action `pan-x pan-y`, non-passive `touchstart`/`touchmove` cancelled for `touchType === 'stylus'`, WebKit `gesture*` events for pinch, ctrl+wheel elsewhere). Verified only with mouse events in Chromium and WebKit under Playwright; **not yet verified with a real Pencil**. If the iPad run shows the Pencil scrolling, dropped strokes or Safari page-zoom, switch to **Option B**: `touch-action: none` plus our own one-finger pan with inertia and two-finger pinch, in `src/ink/pointer.ts` and `src/viewer/zoom.ts`.
- P1.4 draw-with-finger: while it is on in Markup mode, the container uses `touch-action: none`, so fingers draw instead of scrolling; switch to Reading mode to scroll.
- P1.5 hover ring, P5.11, and time-stamped replay (Phase 8) are not built yet; stroke points already carry `t`.

## Phase 2 log

- P2.5 render: `puppeteer-core@25.11.0` (targets Chrome 153.0.8010.36) pinned exactly with `@sparticuz/chromium@153.0.0`. `api/render.ts` has **not been run**: the Chromium build is Linux-only, so it can only be tested on a Vercel deploy. The request guard it uses (`api/_lib/render-guard.ts`) is unit-tested. `vercel.json` sets `maxDuration` 60 for it and omits `memory` (not configurable on Hobby). Record cold/warm timings here after the first preview run. If the function exceeds the size limit, switch to `@sparticuz/chromium-min`.
- P2.7 import: if the render call fails for any reason other than a bad key or rate limit, the thin fetched copy is kept instead of failing the import.
- P2.7 docHeight is measured the first time a page opens (not in a hidden iframe at import time).
- P2.8 deviations: list rows use a "..." button instead of long-press; no favicons (would leak visited hostnames to a third party); the address field is a text input with the URL keyboard because `type=url` rejects addresses typed without `https://`.
- P2.9 links: the iframe never takes pointer events; in Reading mode a short still tap is hit-tested against the snapshot (`src/viewer/links.ts`). Hash links scroll in place; other http(s) links open a sheet (Import this page / Open original in Safari).
- Not done: converting `position: fixed|sticky` header/nav to absolute (planned in P2.6); do it at view time using computed styles once a real page shows the problem.
- Known risk: pages that size themselves with `100vh` are measured with a 0 px iframe, so full-height heroes may collapse. Check on the first real imports.
- Tests: e2e runs with service workers blocked so mocked `/api` routes are not bypassed.
- First real import (an IDFC bank page) came out unstyled. Cause: the `base-uri 'self'` CSP header is inherited by the srcdoc snapshot, so its injected `<base href>` was ignored and every relative stylesheet/image URL resolved against the Vercel origin (served index.html, rejected as "not a stylesheet"). Fix: `base-uri 'self' http: https:` in `vercel.json`. Reproduced and verified in a headless browser under the production headers.
- Known limit: fonts from sites that do not send CORS headers are refused by the browser, so those pages fall back to a system font. Scripts never run in a snapshot, so videos, carousels and menus that need JavaScript stay static.
