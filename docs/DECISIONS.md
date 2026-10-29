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
