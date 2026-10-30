# PageInk

**Mark up real web pages with an Apple Pencil.** Import any page, then write on it, highlight it and attach notes, instead of screenshotting a site and drawing on the screenshot. Everything is saved on your device and needs no account. Your library, text and marks open offline; pictures still come from the original site (see Known limits).

Live: <https://pageink1.vercel.app> (open it on an iPad and use Share → Add to Home Screen).

## What it does

| | |
|---|---|
| **Import** | Paste a web address or open a saved `.html` file. The page is cleaned (no scripts), saved, and fitted to your screen at true size. Sites that block plain requests or build their content with scripts are loaded in a real browser on the server. |
| **Read** | Scroll, zoom, tap links and dropdowns. A link to another page of the same site opens that page with a Back chip. Carousels swipe sideways. Images load as you approach them. |
| **Mark** | Pencil for pen, highlighter and eraser. The Mark tool highlights a word, a sentence, then a paragraph, by meaning colour. Typed notes. A margin lane for handwriting. |
| **Marks stay put** | Highlights find their words again when the layout changes (rotation, late images, opened sections). Ink follows the element it was drawn on, including inside carousels. |
| **Organise** | Collections, tags, pins, search, sort, four themes, accent colours. |
| **Keep** | Library and marks live in IndexedDB. Backup and restore as one file. Study sheet export as Markdown. |

A finger always browses (scroll, tap); the Pencil always marks. Details and the backlog are in [docs/FEATURES.md](docs/FEATURES.md).

## How it works

```
 iPad / browser (PWA)                                   Vercel (serverless)
 ┌────────────────────────────────────────┐             ┌────────────────────────────┐
 │ Library, Reader, toolbar   (src/ui)    │  POST url   │ api/fetch   plain download │
 │ Viewer: sandboxed iframe + SVG ink     │ ──────────▶ │ api/render  headless Chrome│
 │         + live canvas      (src/viewer)│ ◀────────── │ api/health  live commit    │
 │ Ink, marks, notes          (src/ink)   │    HTML     │ checks: same origin, rate  │
 │ Anchoring to words         (src/anchor)│             │ limits, public addresses   │
 │ Sanitizer (DOMPurify)      (src/import)│             │ only, size and time caps   │
 │ IndexedDB library          (src/store) │             └────────────────────────────┘
 └────────────────────────────────────────┘
```

1. The server downloads the page (or renders it) and returns raw HTML. It never stores it.
2. The browser sanitizes it into an inert snapshot and saves it locally.
3. The snapshot is shown in a sandboxed iframe that cannot run scripts. Sites' own JavaScript is not run, so PageInk opens dropdowns and FAQs itself ([src/viewer/widgets.ts](src/viewer/widgets.ts)).
4. Marks are saved as text quotes, element selectors and page positions, so they can be found again later.

## Run it

```
npm install
npm run dev          # http://localhost:5173 (app only, import needs the API)
npm run local        # build + app + API on http://localhost:4488 (local key: local-dev-key)
npm run lint         # TypeScript checks
npm test             # unit tests (Vitest)
npx playwright install chromium webkit    # once
npm run e2e          # browser tests (Playwright, Chromium and WebKit)
```

Add `?debug=1` to the address for an on-screen Pencil event log and a console (for testing on an iPad).

### Settings through environment variables

| Variable | Purpose |
|---|---|
| `APP_KEY` | Optional. If set, API calls from outside the app must send it as `Authorization: Bearer <key>`. The app itself needs no key. |

## Deploy

Push to GitHub and import the repo in Vercel (framework Vite). Pushes to `main` deploy to production; other branches get preview URLs. `/api/health` shows which commit is live. CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs lint, unit tests and the browser tests on every push.

## Project layout

```
api/            Serverless functions (fetch, render, health) and their guards (api/_lib)
src/ui/         Screens and components (Library, Reader, Settings, toolbar, panels)
src/viewer/     The page view: iframe, zoom, links, dropdowns, carousels
src/ink/        Drawing, marking, notes, undo, the SVG ink layer
src/anchor/     Finding a mark again on the page (words, elements)
src/import/     Importing from an address or file; the sanitizer
src/store/      IndexedDB: schema, reads and writes, backup and restore
src/export/     Study sheet
test/           Unit tests        e2e/   Browser tests
docs/           Features, decisions, security, product review, iPad checklist
scripts/        Local server for running the API without Vercel
```

## Docs

- [docs/FEATURES.md](docs/FEATURES.md): core features, specifications, backlog
- [docs/PRODUCT-REVIEW.md](docs/PRODUCT-REVIEW.md): what the product is, what is missing, what next
- [SECURITY.md](SECURITY.md): threat model, protections, how to report a problem
- [docs/DECISIONS.md](docs/DECISIONS.md): key technical decisions and why
- [docs/IPAD-CHECKLIST.md](docs/IPAD-CHECKLIST.md): what to test on a real iPad
- [PLAN.md](PLAN.md) and [docs/PHASE-3.md](docs/PHASE-3.md): the original plan and the marks spec

## Known limits

- Pictures are not saved with a page: offline you get the text, layout and marks, and pictures only if the browser still has them cached.
- Saved copies cannot run a site's scripts, so features that need them ("Load more", live prices, logins) do not work. "Reload with full rendering" captures script-built pages.
- Sites that block automated access cannot be imported from a link. Save the page from your own browser and use "Import file".
- Metered paywalls show only what the site shows without scripts.
- The Pencil has been tested in automated browsers, not yet on a real iPad: see the checklist.
