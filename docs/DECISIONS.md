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

## Library, organisation and appearance (between Phase 2 and Phase 3)

- IndexedDB is now version 2: adds a `collections` store. The upgrade is additive (`oldVersion < 2`), nothing is migrated or deleted. New optional `Page` fields: `collectionId`, `pinned`, `cover`, `description`, `openedAt`.
- Organisation is deliberately simple: one collection per page (a folder, with a colour), free tags, a pin. Pinned pages always sort first. Search matches title, URL, site, tags and the page description; every word must match. "Recently opened" uses `openedAt`, set when a page is opened in the Reader.
- Cover images are the page's own `og:image` / `twitter:image`, resolved against the final URL and loaded straight from that site with no referrer. If it fails, the card falls back to a gradient derived from the site name. The first image request does tell that site you imported its page; use a layout without covers if that matters (not built).
- Drag and drop: cards are draggable onto a collection, Pinned or Unsorted in the sidebar. Verified in Chromium; Playwright WebKit cannot drive HTML5 drag and drop, so it is untested there and needs checking on the iPad.
- Appearance: four themes (Auto follows the OS, Dark, Light, Paper), an accent colour with automatic text contrast, and comfortable/compact density. All are CSS variables on `<html>` (`data-theme`, `data-density`, `--accent`), so every screen follows them, including the toolbar and the reader backdrop. The imported page itself is never recoloured.
- The library sidebar becomes a scrolling row of chips below 900 px so portrait iPad keeps the same filters.

## Access without a key, and Phase 3 (living marks)

- **No key for users.** A browser app cannot keep a secret, so the shared `APP_KEY` was removed from the user's path. `/api/fetch` and `/api/render` now accept (a) requests from the app's own pages (`Sec-Fetch-Site: same-origin`, or an `Origin` whose host equals `Host`; other sites' scripts cannot forge these) or (b) the optional `APP_KEY` as a Bearer token, which still works for scripts and stays in Settings as "Access key (optional)". Backstops: private-network blocking (SSRF guard), per-visitor rate limits (fetch 20/min, render 5/min per IP) plus a per-instance ceiling. **Known limit:** a non-browser script can fake those headers, and the counters are per server instance. If abuse appears, add Turnstile or sign-in (the planned Phase 9 auth).
- **Anchoring.** Highlights store the exact words plus 32 characters of context and a position (W3C TextQuote + TextPosition); notes store words, element selector and page point. On every load (and after fonts or images arrive) each mark is found again: text, then element, then page point. If words cannot be found the mark is shown dashed under "Needs attention", never deleted.
- **Mark tool.** Drag snaps to whole words; holding still 450 ms grows to the sentence (`Intl.Segmenter`), holding again to the paragraph. Footnote markers like `[1]` are not included at a sentence start. Found by testing: a position on the boundary between two text nodes belongs to the node that starts there.
- **Meanings** (Important, Question, Idea, Confusing, Issue) set colour, grouping and the study sheet order.
- **Margin lane** (off by default, 320 doc px, remembered per page): ink to the right of the page is tagged `lane: 'margin'` and gets a leader line to the nearest real text block at its height. (In Auto layout the page now gets narrower to make room, so the scale stays at true size; see "Display fidelity".)
- **Spotlight** dims everything except one highlight; any tap or Escape ends it, and that tap does not start a mark underneath.
- **Remember where you were:** scroll position and lane state are saved per page (`Page.view`).
- **Not built from the Phase 3 spec:** layer toggles and "clean read" (P3.15) and the first-run tour (P3.20). Highlights and notes are erased with the existing Eraser (undoable), and ink still saves as before.
- Verified live in Chrome against Wikipedia (word, sentence and paragraph marks, a note, the panel, spotlight, margin lane) and by 18 browser tests; run on a real iPad is still outstanding.

## Display fidelity: Auto layout, rotation, lazy images (reverses D3)

User feedback: imported pages did not feel like the original site: tiny desktop layout on the iPad, slow image loading, the view jumping, hard to scroll and find things, no rotation support.

- **D3 (freeze the layout at 1280 px and scale it) is reversed.** That shows a shrunken desktop page (about 64 percent size on an iPad in portrait) and stops a site from serving its tablet design. Pages now default to **Auto** (`Page.layoutWidth = 0`): the snapshot is laid out at the width of the screen, at true size, so media queries pick the same layout Safari would. Pages that were 1280 are migrated once (`migrateToAutoLayout`); Fixed widths (Desktop 1280, Tablet 820, Phone 390) are still a per-page choice in the page options sheet and a default in Settings.
- **Rotation and resizing** (rotate, Split View, window resize) lay the page out again at the new width (debounced 160 ms) with no change of zoom. Pinching to zoom pauses auto re-layout until "fit" is restored.
- **Your place is kept.** Before any change that moves content (new width, an image arriving) the viewer remembers the element at the top of the screen and scrolls back to it afterwards (only if it moved by 2 px or more, so momentum scrolling is not interrupted).
- **Marks follow the content.** Highlights and notes were already found again from their words. Ink now records the width it was drawn at (`layoutAt`) and is translated with the element it was drawn on (`anchor.element`), so it stays on its paragraph through a rotation and back. Margin ink keeps its distance from the page edge and follows its paragraph via `leader.top`. Ink drawn before this change is assumed to have been drawn at the old 1280 width. **Known limit:** a stroke that spans several paragraphs moves as one piece with the paragraph it started on.
- **The margin lane no longer shrinks the page.** In Auto the page gets narrower to make room (iPad landscape: about 860 px wide page plus the 320 px lane), so text stays at true size.
- **Images load as you get near them.** The sanitizer parks every image address (`data-pk-src`, `data-pk-srcset`) behind a 1x1 transparent GIF; the viewer restores images within about 2.5 screens below and 1 above the current view. Before, every image (hundreds on a big site) was requested the moment a page opened because the page is shown at full height, where the browser's own lazy loading never waits. Pages saved by an earlier version are cleaned again once when opened (`SANITIZER_VERSION` is now 2). Measured on the Wikipedia article: opens in about 1.6 s with 4 of 17 images fetched.
- **Known limits:** CSS background images and videos are still fetched eagerly; the page is a static copy, so a site that serves different HTML to phones (not just different CSS) still shows the HTML that was captured; ink and highlights re-layout instantly but a very long page re-measures in a few frames.

## Hosting lessons, backup and restore

- **Vercel was connected to the wrong repository.** The project `pageink1` was watching a separate private repo `Saketh567/pageink1` (first commit "Initial commit"), so nothing pushed to `Saketh567/pageink` ever deployed. Fixed by reconnecting Settings, Git to `Saketh567/pageink`. Check which commit is live at any time: `https://pageink1.vercel.app/api/health` returns `{ok, keyConfigured, commit}`, and Settings shows "PageInk build <commit>".
- **Visitors never need a Vercel login** on `pageink1.vercel.app` (public). Vercel Authentication ("Deployment Protection") locks the long branch and per-deployment addresses (`pageink1-git-main-...`, `...-git-phase-2-...`); set it to Disabled in Settings, Deployment Protection to make every address public. Share only the short address.
- **Where data lives:** IndexedDB in the browser on one device and one web address (the localhost copy and the Vercel site have separate libraries). No accounts, no server copy. Safari can clear a site's data after a long idle spell unless the app is on the Home Screen (the app asks for persistent storage when installed).
- **Backup and restore** (Settings, Your data): one `pageink-YYYY-MM-DD.pageink.json` with pages, page copies, marks and collections, handed to the share sheet (Save to Files, iCloud Drive, AirDrop) or downloaded. Restore **merges**: records that are missing or newer are added, nothing is deleted or replaced by older data. The file is untrusted input: it is validated whole (a bad file changes nothing) and every page copy is sanitized again. Known limit: pin and tag edits do not change a page's `updatedAt`, so they only come back onto a page that is missing. Settings are not part of the backup.
- The library shows a back-up reminder once there is a page of your own and no backup in 7 days, and a "Continue where you left off" card for the last page opened.
- Imported `.html` files are named after the page's own `<title>`, not the file name.
