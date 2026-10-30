# PageInk Version 2: Execution Plan (H1 and the start of H2)

For the model that builds v2 (Claude Sonnet) and for the owner who judges it. The strategy and the reasons are in [V2-VISION.md](V2-VISION.md). This plan breaks the next 6 to 9 months into milestones **M1 to M13**, in dependency order. Each milestone can be shipped and tested on localhost on its own.

## 0. Ground rules (read before every milestone)

1. **Branch.** All work happens on branch `v2`. Never commit to, merge into or push to `main` or `v1-stable`. Never move or delete the `v1.0.0` tag. One milestone may use a short-lived branch `v2-mN-<name>` that is merged into `v2` only when the gate passes.
2. **v1 keeps working.** Every existing unit test (`test/`) and browser test (`e2e/`) must stay green at every commit. Do not delete or weaken an existing test to make it pass. If an old test must change because behaviour intentionally changed, say so in the commit message and the milestone report.
3. **Untrusted pages.** Every feature must keep the protections in [SECURITY.md](../SECURITY.md): the sandboxed iframe without `allow-scripts`, DOMPurify on every page entering the library (including restores and hand-offs), the SSRF guard (`api/_lib/guard.ts`, `safe-fetch.ts`, `pin-proxy.ts`) on every server fetch, same-origin and rate-limit checks on every API route, and no URL logging. Update SECURITY.md in the same milestone when a protection is added or changed.
4. **Data is sacred.** No migration deletes or rewrites user data destructively. Every stored-data change goes through the migration runner (M1) and has a unit test that upgrades data written by the previous version.
5. **Read before editing.** Read every file you change, and grep for every caller of a function you change.
6. **Smallest complete change.** Reuse what exists (`idb`, DOMPurify, signals, the `Sheet` component in `src/ui/Sheets.tsx`, the `notice` toast). Only add a dependency where this plan names one.
7. **Look up APIs; do not guess.** For library or browser APIs (fflate, Chrome built-in AI, Anthropic API, Upstash REST), check current documentation first (Context7 / `ecc:docs-lookup`, or the `claude-api` skill for Anthropic).
8. **Plain language** in UI text, comments and reports. File header comments follow the existing style (one short paragraph saying what the file does).

### The gate (must pass before every commit)

```
npm run lint
npm test
npm run build
npm run e2e          # Chromium and WebKit (Playwright), uses the built preview on port 4173
```

New browser tests that check layout set the viewport per test, for example `test.use({ viewport: { width: 820, height: 1180 } })` (iPad portrait) and `{ width: 390, height: 844 }` (phone). The e2e tests mock `/api/*` with `page.route` (see `e2e/library.spec.ts`); the preview server has no API, so any new client code that calls an API must fail quietly when the call fails.

### Manual check in Chrome (every milestone)

Run `npm run local` (builds, serves the app and the real API on http://localhost:4488 with production headers). Open Chrome DevTools device mode at **820x1180** and **390x844**, run the milestone's acceptance list, and check the console has no errors and no CSP violations.

### Size key
S = up to 1 day of model work, M = 2 to 4 days, L = 1 to 2 weeks.

---

## Milestone overview

| # | Milestone | Size | Depends on | Horizon |
|---|---|---|---|---|
| M1 | Versioned foundation (migration runner, database v3) | S/M | none | H1 |
| M2 | Complete pages: pictures, styles and fonts saved | L | M1 | H1 |
| M3 | Portable data: page archives, backup v2, W3C annotation export | M | M2 | H1 |
| M4 | Find anything: search across all page text and marks | M | M1 | H1 |
| M5 | Print and PDF with marks | M | M2 | H1 |
| M6 | Clean read, layers and a first-run tour | S | none | H1 |
| M7 | Accessibility pass and translation-ready text | M | M6 | H1 |
| M8 | Fresh copies: age badge, page history, "what changed" | M | M1, M2 | H1 |
| M9 | Send to PageInk: capture from your own browser (spike, then ship) | M | M2 | H1 |
| M10 | Server cost and abuse guard | S/M | none | H1 |
| M11 | AI layer v0 (opt-in, cites your marks) | L | M4 | H2 start |
| M12 | Sync design and local prototype | L | M1, M3 | H2 start |
| M13 | Origin-isolated viewer (spike, then decide) | L | M2 | H2 start |

M6 and M10 have no dependencies and can be done at any point if a milestone is blocked.

---

## M1. Versioned foundation

**Goal:** give stored data a version and a safe, tested way to upgrade it, so every later milestone can change the data without risk.

**User-visible result:** nothing changes in daily use. Settings, "Your data" shows a new line "Library format: 3". Existing libraries open exactly as before.

**Tasks**
1. Create `src/store/migrate.ts`: an ordered list of steps `{ to: number; name: string; run(db): Promise<void> }` and `runMigrations()`, which reads the setting `dataVersion` (missing means 2), runs each step above it in order, and saves `dataVersion` after each step. Steps must be idempotent (safe to run twice).
2. Register `migrateToAutoLayout` as the first step (`to: 2`), keeping its existing `autoLayoutV1` setting check so libraries that already ran it are untouched. `test/layout.test.ts` imports `migrateToAutoLayout` from `src/store/repo.ts`, so keep that export working (leave the function in `repo.ts` and call it from the step, or re-export it).
3. `src/store/db.ts`: open IndexedDB version **3**. In `upgrade`, `if (oldVersion < 3)`: add a multi-entry index `assets` on the `snapshots` store (`keyPath: 'assets', multiEntry: true`) and create a store `texts` (`keyPath: 'pageId'`). Purely additive.
4. `src/store/schema.ts`: add optional fields, no required ones:
   - `Snapshot.assets?: string[]` (hashes of stored assets used by this page, filled in M2).
   - `Snapshot.archive?: { state: 'none' | 'partial' | 'complete'; saved: number; total: number; bytes: number; at: ISO }`.
   - `export interface PageText { pageId: ID; title: string; text: string }`.
   - `Page.schemaVersion` type becomes `1 | 2`; new pages write `2`. Nothing else depends on the literal (grep `schemaVersion` to confirm; update `storePage` in `src/import/import-url.ts` and `seedSample` in `repo.ts`).
5. Register step `to: 3` "page text for search": for every page with a snapshot, extract text (`DOMParser`, `body.textContent`, collapse whitespace, cap at 200,000 characters) into `texts`. It runs in the background after the app is ready (call it from `App.tsx` after `setReady(true)`, not before), in batches of 25 pages with `await new Promise(r => setTimeout(r))` between batches so the UI stays responsive.
6. Add `putPageText(pageId, title, html)` in `src/store/repo.ts`; call it from `storePage` and `recapturePage` in `src/import/import-url.ts`, and from `restoreBackup` in `src/store/backup.ts`. `deletePage` also deletes the `texts` row (add `texts` to its transaction).
7. `src/ui/App.tsx`: replace the `migrateToAutoLayout()` call with `runMigrations()` (the auto-layout step runs before the screen is shown, as today; the text step runs after).
8. `src/ui/Settings.tsx` `DataCard`: add the "Library format" line reading `dataVersion`.
9. `src/store/backup.ts`: `parseBackup` must accept and keep the new optional `Snapshot` fields; check `assets` is an array of 64-character hex strings if present, otherwise reject the file.

**Data model / API changes:** IndexedDB v3 (index `snapshots.assets`, store `texts`); setting `dataVersion`; optional fields above. No API change.

**Tests**
- Unit `test/migrate.test.ts` (with `fake-indexeddb`, like `test/repo.test.ts`): a v2 database with pages, snapshots, ink annotations with no `layoutAt` and `defaultWidth: 1280` upgrades to v3 with all records intact, auto-layout applied once, `texts` filled, `dataVersion` = 3; running again changes nothing.
- Unit: `putPageText` caps and normalises text; `deletePage` removes the text row.
- Unit: `parseBackup` accepts v1 files without the new fields and rejects bad `assets` values.
- e2e (existing tests): all green. Add one check in `e2e/backup.spec.ts` or a new `e2e/foundation.spec.ts`: Settings shows "Library format: 3".

**Acceptance (Chrome, 820x1180 and 390x844)**
- Open an existing v1 library (import a v1 backup made on `main` first): every page, mark and collection is present; ink sits where it did.
- Settings shows "Library format: 3".
- DevTools, Application, IndexedDB `pageink` shows version 3, a `texts` store with one row per page.

**Security:** no new input surface. Backups remain untrusted input.

**Risks:** a slow text backfill on large libraries (mitigated by background batches); WebKit index creation on an existing store (covered by the WebKit e2e run).

**Real iPad:** open the installed app after the update; library intact; nothing slower.

---

## M2. Complete pages: pictures, styles and fonts saved

**Goal:** every saved page keeps its own pictures, stylesheets and fonts, so it looks right offline, does not change when the site changes, and no longer reports your reading to the site.

**User-visible result:** after import, a small status on the page card and in the reader's More menu: "Saving for offline… 12 of 40", then "Saved for offline". In flight mode the page opens with pictures and styling. A page whose assets could not all be saved shows "Partly saved for offline" with a "Try again" action.

**Design (keep to it)**
- Browsers block reading picture bytes from other sites, so assets come through a new server route **`POST /api/asset`** `{ url }` that returns the raw bytes. It reuses the SSRF guard and pinned connection.
- Assets are stored once in the existing `blobs` store, keyed by the SHA-256 hash of their bytes (`{ id: hash, type, data }`). A page's snapshot lists its hashes in `Snapshot.assets` (indexed in M1).
- The stored snapshot HTML refers to an archived asset by the token **`pk-asset:<hash>`**. The original address is kept in `data-pk-orig` on elements so the page can be re-archived. Tokens are swapped for `blob:` URLs only in memory, just before the page is shown.
- Archiving runs in the background after import; the page opens immediately as today. If anything fails, the page behaves exactly like v1 (original addresses).

**Tasks: server**
1. `api/_lib/safe-fetch.ts`: extract the redirect-and-pin loop into an internal function so two callers share it. `safeFetch` keeps its exact behaviour (all of `test/safe-fetch.test.ts` stays green). Add `safeFetchAsset(url, deps)` returning `{ bytes: Uint8Array; type: string; finalUrl: string }`, with:
   - `accept: image/avif,image/webp,image/*,text/css,font/*;q=0.9,*/*;q=0.1`,
   - a content-type allowlist: `image/(png|jpeg|gif|webp|avif|svg+xml|x-icon|vnd.microsoft.icon)`, `text/css`, `font/(woff2|woff|ttf|otf)`, `application/(font-woff|font-woff2|x-font-ttf|vnd.ms-fontobject|font-sfnt|octet-stream)` (octet-stream only when the address ends in a font extension); anything else is `NOT_ASSET`,
   - a 4 MB cap (reuse `MAX_BYTES`) and the same 10 s timeout.
2. `api/_lib/limits.ts`: `assetLimiter` = 300 per minute per visitor and 3,000 per minute per instance (same pattern as `fetchLimiter`).
3. Create `api/asset.ts` modelled on `api/fetch.ts`: POST only, `checkAccess`, `assetLimiter`, `safeFetchAsset`; on success respond `200` with the bytes and headers `Content-Type: <allowed type>`, `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'; sandbox`, `Content-Disposition: attachment`, `X-Final-Url: <finalUrl>`. Errors use the same JSON shape and codes as `api/fetch.ts` plus `NOT_ASSET` (415). Never log the URL.
4. `scripts/local.mts`: add `'/api/asset'` to `routes`, and let a handler send binary (the shim's `res.end(Buffer)` already works; make sure `json` is not forced).
5. `vercel.json`: add `blob:` to `font-src` (fonts become blob URLs). No other CSP change.

**Tasks: client**
6. Create `src/archive/css.ts`: `rewriteCss(css: string, cssUrl: string, map: (absUrl: string) => string | null): { css: string; urls: string[] }`. It finds every `url(...)` (quoted or not) and `@import` (`url()` or string form), resolves each against `cssUrl`, returns all absolute http(s) URLs, and rewrites each to `map(abs) ?? abs` (always absolute, because inlined CSS would otherwise resolve against the page). Leaves `data:` URLs alone; drops `javascript:` and other schemes.
7. Create `src/archive/collect.ts`: `collectAssets(doc: Document, baseUrl: string)` returns ordered lists: stylesheets (`link[rel~=stylesheet][href]`), images (`img[data-pk-src]`, the best candidate of each `data-pk-srcset` up to 1600w or 2x, `source[data-pk-srcset]`, `[style*="url("]` backgrounds, `<style>` `url()`), skipping `data:` and non-http(s).
8. Create `src/archive/archiver.ts`: `archivePage(pageId, opts: { fetchAsset?(url): Promise<{ bytes; type }>; onProgress?(saved, total): void })`:
   - loads the snapshot; skips if `archive.state === 'complete'`;
   - fetches stylesheets first; follows `@import` to depth 2; replaces each `<link rel=stylesheet>` with `<style data-pk-orig="<url>">` holding the rewritten CSS; collects font and image URLs from CSS;
   - fetches fonts, then images in document order, at most 6 at a time;
   - budget per page: at most 300 assets and 30 MB; skips anything over budget (counts as not saved);
   - SVG: sanitize with `DOMPurify.sanitize(text, { USE_PROFILES: { svg: true, svgFilters: true } })` before storing;
   - stores each asset in `blobs` with `id = sha256(bytes)`; replaces addresses in the snapshot with `pk-asset:<hash>` (in `data-pk-src`, `data-pk-srcset` candidates, `style` attributes and `<style>` text) and sets `data-pk-orig` on elements;
   - writes the snapshot back with `assets` (unique hashes) and `archive` (`complete` if everything in budget was saved, else `partial`) in one transaction; can be re-run safely and only fetches what is missing;
   - the default `fetchAsset` POSTs to `/api/asset` (with the `appKey` bearer if set, like `callApi` in `import-url.ts`); any failure of a single asset is skipped, never thrown.
9. Create `src/archive/resolve.ts`: `withAssetUrls(html: string, getBlob: (hash) => Promise<Blob | undefined>): Promise<{ html: string; revoke(): void }>` replaces every `pk-asset:<hash>` with `URL.createObjectURL(blob)`; a missing blob falls back to the element's `data-pk-orig` address if present, else the blank image. Store blobs as `Blob`; if WebKit fails to store a `Blob` in IndexedDB in the e2e run, store an `ArrayBuffer` plus type instead (decide by test, write the decision in docs/DECISIONS.md).
10. `src/import/sanitize.ts`: no behaviour change for normal pages, but add tests proving `pk-asset:` tokens in `data-pk-src`, `data-pk-srcset`, `style` attributes, `<style>` and `data-pk-orig` survive a second `sanitize()` (pages are re-sanitized when `SANITIZER_VERSION` rises). If they do not survive, fix it inside `sanitize` (do not skip sanitizing).
11. `src/ui/Reader.tsx`: after the snapshot is loaded (and re-sanitized if old), call `withAssetUrls` before `createViewer`; call `revoke()` in the cleanup `stop()`. After `storePage` and after `recapturePage` (in `src/import/import-url.ts`), start `archivePage` in the background (do not await it in the import path).
12. `src/viewer/viewer.ts`: no change expected (it already restores `data-pk-src`), but verify `blob:` images trigger `scheduleMeasure` like normal images.
13. Status UI: a small signal `archiveProgress` (`src/ui/state.ts`) updated by `onProgress`; show it in `src/ui/PageCard.tsx` (one short line or icon with an accessible label) and in the reader's More menu (`src/ui/ToolTray.tsx`), with "Try again" calling `archivePage` for `partial` pages. Add an "Offline copy" line to the page sheet (`src/ui/Sheets.tsx` `PageSheet`).
14. `src/store/repo.ts` `deletePage`: include `blobs` in the transaction; for each hash in the deleted page's `snapshot.assets`, delete the blob if `snapshots.index('assets').count(hash)` is 0 after the snapshot is removed.
15. No migration step is needed: old pages simply have no `archive` field. Add "Save all pages for offline" to Settings, "Your data", which runs `archivePage` over pages without `complete`, one at a time, with progress.

**Data model / API changes:** new `POST /api/asset`; `blobs` store used for assets; `Snapshot.assets` and `Snapshot.archive` filled; `pk-asset:` token and `data-pk-orig` attribute in stored HTML; CSP `font-src` adds `blob:`.

**Tests**
- Unit `test/safe-fetch.test.ts` (extend): asset allowlist accepts png/css/woff2, rejects `text/html` and `application/javascript` as `NOT_ASSET`; size cap; redirect to a private address is refused; existing HTML tests unchanged.
- Unit `test/asset-api.test.ts`: the handler refuses GET, refuses cross-site requests, returns the security headers, never echoes the URL in errors.
- Unit `test/archive-css.test.ts`: relative, quoted, unquoted, `@import`, `data:` and `javascript:` cases; output URLs are absolute.
- Unit `test/archive.test.ts` (jsdom + fake-indexeddb, injected `fetchAsset`): a page with a stylesheet (which imports another and references a font and a background), 3 images and an SVG ends `complete`, every reference becomes a token, the SVG's script is removed, duplicate images are stored once, re-running fetches nothing; a failing asset gives `partial`; over-budget assets are skipped; `deletePage` keeps blobs shared with another page and removes the rest.
- Unit `test/sanitize.test.ts` (extend): tokens survive re-sanitizing.
- e2e `e2e/offline.spec.ts` (Chromium and WebKit): mock `/api/fetch` with a page referencing `https://img.example/a.png` and `https://css.example/s.css`; mock `/api/asset` to return a PNG and CSS; import; wait for "Saved for offline"; then `page.route('https://img.example/**', r => r.abort())` and `context.setOffline(true)`; reopen the page: the image's `naturalWidth > 0` and the CSS rule applies. A second test: `/api/asset` returns 500, the page still opens and shows "Partly saved for offline" (proves quiet failure).
- All existing e2e green (they do not mock `/api/asset`; archiving must fail quietly there).

**Acceptance (Chrome, 820x1180 and 390x844, using `npm run local` and real sites)**
- Import a Wikipedia article and a shop product page. Within a minute both show "Saved for offline".
- DevTools, Network, Offline: reopen both. Pictures, fonts and layout match the online view; no requests to the original sites in the Network panel; no CSP errors.
- Delete one page: storage used (Settings) goes down; the other page still has its pictures.
- An old v1 page without an offline copy still opens normally; "Save all pages for offline" fills it in.

**Security**
- `/api/asset` uses the same SSRF guard, pinning, redirect checks, same-origin check, rate limits and no-logging rules as `/api/fetch`; add it to SECURITY.md section 1 and remove known limit 7 ("Pages can track you") for archived pages, noting it still applies until a page is archived.
- Only allowlisted types are stored. SVGs are sanitized. Assets are only ever used as `blob:` URLs in `img`, CSS and `@font-face`, never navigated to or put in an iframe.
- The response carries `CSP: sandbox` and `Content-Disposition: attachment` so a stored asset can never run as a page from our origin.

**Risks:** Vercel bandwidth and invocations grow (one call per asset; mitigated by per-page budget and rate limits; measure in the report); sites that block the server also block `/api/asset` (the page keeps original addresses); WebKit storing Blobs in IndexedDB; very large pages hitting the storage quota (show the error, keep `partial`).

**Real iPad:** import 3 pages, turn on Airplane Mode, open each from the Home Screen app: pictures and fonts present; Settings storage figure plausible.

**Size:** L.

---

## M3. Portable data: page archives, backup v2, W3C annotation export

**Goal:** everything in PageInk can leave PageInk in open formats, and backups include the saved pictures.

**User-visible result:**
- Page sheet: **"Export page"** produces `<title>.pageink.zip` containing `page.html` (opens in any browser with its pictures), `assets/`, `annotations.jsonld` (W3C Web Annotations), `marks.md` (the study sheet) and `manifest.json`.
- Library: **"Import file"** also accepts `.pageink.zip`.
- Settings: **"Back up everything"** now writes `pageink-YYYY-MM-DD.pageink.zip` (backup v2, with assets). Restore accepts v1 `.json` and v2 `.zip`.

**Tasks**
1. Add dependency **`fflate`** (small ZIP library, no sub-dependencies). Use its streaming unzip for restore.
2. Create `src/export/web-annotation.ts`: `toWebAnnotation(a: Annotation, page: Page)` and `fromWebAnnotation(json)`:
   - highlight/note: `target.selector` = `[{ type: 'TextQuoteSelector', exact, prefix, suffix }, { type: 'TextPositionSelector', start, end }]`, plus `CssSelector` when `anchor.element` exists; `body` = `TextualBody` for note text and a `tagging` body for the meaning; `motivation` `highlighting` or `commenting`;
   - ink: `SvgSelector` with the stroke path, plus a `pageink:ink` extension object holding the raw `points`, `tool`, `size`, `layoutAt`, `lane`, `leader`;
   - `@context`: `http://www.w3.org/ns/anno.jsonld` plus a `pageink` namespace; `target.source` = page URL; `created`/`modified` from the record.
   - The round trip `fromWebAnnotation(toWebAnnotation(a))` must equal the original annotation (fields we own).
3. Create `src/export/page-archive.ts`: `exportPage(pageId): Promise<Blob>` (tokens rewritten to relative `assets/<hash>.<ext>` in `page.html`, the CSP meta tag kept) and `importPageArchive(file): Promise<Page>` (validates `manifest.json`, size caps: 100 MB per archive, 300 assets; every asset's SHA-256 must equal its file name; types limited to the M2 allowlist; SVGs sanitized again; `page.html` passed through `sanitize()`; annotations through the same checks as `parseBackup`; new page ID if the ID already exists with different content).
4. `src/store/backup.ts`: `buildBackup` writes version 2 as a ZIP: `backup.json` (same shape as v1 plus `version: 2` and snapshot `assets`) and `assets/<hash>`. `parseBackup` keeps accepting v1 JSON exactly as today. Add `parseBackupZip` with the same checks plus asset hash verification; raise `MAX_BACKUP_BYTES` for ZIPs to 1 GB and read entries as streams.
5. `src/ui/Settings.tsx`: file input accepts `.json,.zip,application/json,application/zip`; restore picks the parser by content (ZIP magic bytes `PK`), not by name.
6. `src/import/file-import.ts` and the Library import control: accept `.pageink.zip`.
7. `src/ui/Sheets.tsx` `PageSheet`: "Export page" using `navigator.share({ files })` with download fallback (reuse the logic in `saveBackup`; extract a shared `shareOrDownload(file)` helper into `src/export/share.ts` and use it in both places).
8. docs: add `docs/FORMATS.md` describing the page archive and backup v2 layouts (short, for other tools).

**Data model / API changes:** backup format v2 (ZIP); page archive format v1; no IndexedDB change.

**Tests**
- Unit `test/web-annotation.test.ts`: highlight, note, ink and margin ink round trips; output validates against the required W3C fields (`@context`, `type: 'Annotation'`, `target`).
- Unit `test/page-archive.test.ts`: export then import gives an identical snapshot text and marks; a tampered asset (hash mismatch), a disallowed type, an archive over the cap, and a `page.html` with a `<script>` are handled (rejected or cleaned).
- Unit `test/backup.test.ts` (extend): v1 JSON still restores; v2 ZIP restores pages, marks, collections and blobs; a ZIP with a bad entry is rejected whole and changes nothing.
- e2e `e2e/backup.spec.ts` (extend): back up, clear the database, restore the ZIP, open a page offline with its picture. Export a page and re-import it as a new page.

**Acceptance (820x1180 and 390x844)**
- Export a marked Wikipedia page; unzip it on the computer; double-click `page.html`: it opens in Chrome with pictures, no network needed.
- Back up, delete the site data in DevTools, restore: everything returns, pictures included offline.
- A v1 backup file made on `main` still restores.

**Security:** archives and backups are untrusted input: whole-file rejection, hash verification, type allowlist, sanitizing of HTML and SVG, size caps. Exported `page.html` keeps the script-blocking CSP meta tag.

**Risks:** memory use when zipping hundreds of MB on an iPad (stream entries; test with a 300 MB library in the report); `navigator.share` with large files on iOS.

**Real iPad:** back up to iCloud Drive via the share sheet, restore on the same iPad after deleting a page; export a page and AirDrop it to a Mac.

**Size:** M.

---

## M4. Find anything

**Goal:** one search box finds pages by title, by any word on the page, and by any highlight or note, and jumps straight to the mark.

**User-visible result:** typing in the Library search shows three groups: **Pages** (as today), **In your marks** (quote or note with its meaning colour and page title) and **On pages** (a snippet with the words in bold). Tapping a mark result opens the page scrolled to the mark with a short spotlight.

**Tasks**
1. Create `src/store/search.ts`: `searchLibrary(query, opts?): Promise<{ pages: Hit[]; marks: MarkHit[]; text: TextHit[] }>`:
   - words split like `applyFilters` in `src/store/organize.ts`; every word must match; case- and accent-insensitive (`normalize('NFD').replace(/\p{M}/gu, '')`);
   - marks: highlights (`anchor.text.quote.exact`) and notes (`note.text`), live only (`!deleted`);
   - text: from the `texts` store; snippet of about 120 characters around the first match;
   - results capped (50 per group), ranked: title matches first, then most recent `openedAt`;
   - an in-memory cache of `texts` and annotations, invalidated by a simple version counter bumped in `putAnnotation`, `putPageText`, `deletePage` and restore (`src/store/repo.ts`, `backup.ts`);
   - shortcut comment: plain scan; upgrade to an inverted index if search exceeds 300 ms on 1,000 pages.
2. `src/ui/Library.tsx`: when the query is non-empty, render the three groups below the filtered page grid (or a "Search everything" toggle if the grid already shows results); debounce 150 ms; empty and no-result states.
3. Routing: `src/ui/App.tsx` parses `/p/<pageId>/m/<markId>`; pass `markId` to `Reader`. `src/ui/Reader.tsx`: after the editor is created, if `markId`, call `marksApi.reveal(markId)` then `marksApi.spotlight(markId)` (both exist in `src/ui/state.ts`, filled by the editor).
4. Highlight matched words in snippets with `<mark>` built from text nodes (never `innerHTML` with page text).

**Data model / API changes:** none (uses M1 `texts`).

**Tests**
- Unit `test/search.test.ts`: word AND matching, accents, mark hits, deleted marks excluded, snippet bounds, cache invalidation after `putAnnotation`; a timing test: 1,000 synthetic pages of 50 KB searched in under 300 ms in Node (skip on CI if flaky, but keep it locally).
- e2e `e2e/search.spec.ts`: import two mocked pages, highlight a phrase on one, search a word from the highlight: the mark group shows it; tap: the reader opens with the spotlight on that mark. Search a word only in page text: the snippet appears. Run at 820x1180 and 390x844.

**Acceptance:** with 20 real pages, searching a remembered phrase finds it in under a second on a laptop; the result list is readable at phone width; VoiceOver/keyboard can reach each result (buttons with names).

**Security:** search shows page text, so render it as text only.

**Risks:** memory with very large libraries (texts capped at 200 KB per page for the cache).

**Real iPad:** search a library of 50+ pages; typing stays smooth.

**Size:** M.

---

## M5. Print and PDF with marks

**Goal:** print or save as PDF any page with its ink, highlights and notes exactly where they are on screen.

**User-visible result:** reader More menu and page sheet: **"Print or save as PDF"**. The system print sheet opens (on iPad: Print, or Save to Files as PDF). Notes appear as numbered pins with the note texts listed at the end. Option "Without marks".

**Tasks**
1. Create `src/export/print.ts`: `buildPrintDocument(viewer, page, marks, { withMarks }): string`:
   - starts from the current snapshot document (`viewer.iframe.contentDocument`, already laid out at `viewer.layoutWidth`) serialized; asset tokens replaced by `data:` URLs (read from `blobs`) so the document is self-contained;
   - removes `FREEZE_CSS` overflow rules; adds `@page { margin: 12mm }` and `body { width: <layoutWidth>px }` with `print-color-adjust: exact`;
   - appends the ink SVG (clone of `viewer.svg`, spotlight removed) positioned `absolute; top: 0; left: 0`, at the same width and height; margin lane included when open;
   - appends a "Notes" section listing note texts with their numbers, and a footer with title, URL and capture date.
2. Print through a hidden iframe created by the app with `sandbox="allow-same-origin allow-modals"` (modals allow `print()`; **no** `allow-scripts`) using `srcdoc`; call `iframe.contentWindow.print()` from the app after load; remove the iframe after `afterprint`.
3. Fallback when `print()` is unavailable or throws (some installed iOS web apps): share a `<title>-marked.html` file via `shareOrDownload` (from M3) with a hint "Open in Safari, then Share, Print".
4. UI entries in `src/ui/ToolTray.tsx` (More group) and `src/ui/Sheets.tsx`.

**Data model / API changes:** none.

**Tests**
- Unit `test/print.test.ts` (jsdom): the document has no `<script>`, keeps the CSP meta tag, contains the SVG with the same number of mark shapes, lists notes, and has no `pk-asset:` tokens left.
- e2e `e2e/print.spec.ts` (Chromium): stub `window.print` on the print iframe, assert it was called and the iframe document contains the SVG paths; Chromium only: `page.pdf()` of the built document is non-empty. WebKit: assert the iframe is built and the fallback path works when `print` throws.

**Acceptance:** in Chrome at 820x1180, print preview of a marked Wikipedia page shows ink and highlights aligned with the text on the first three pages; same at Phone width layout (390); "Without marks" shows the clean page.

**Security:** the print iframe has no `allow-scripts`; content is the already-sanitized snapshot.

**Risks:** tall pages split mid-line; ink crossing page breaks (accept; note in docs); iOS standalone print support (fallback exists).

**Real iPad:** print to PDF, save to Files, open the PDF: marks aligned.

**Size:** M.

---

## M6. Clean read, layers and a first-run tour

**Goal:** read the page without your marks when you want to, and learn the app in 30 seconds.

**User-visible result:** reader More menu: **Layers** with three switches (Ink, Highlights, Notes) and "Hide all marks" (clean read). First time a page opens: a 3-card tour ("A finger scrolls and taps links", "The Pencil writes, highlights and marks", "Open the margin for notes"), skippable, replacing today's one-line hint.

**Tasks**
1. `src/ui/state.ts`: `hiddenLayers = signal<Set<'ink' | 'highlights' | 'notes'>>(new Set())`, reset when a page opens.
2. `src/ink/ink-layer.ts` already groups shapes by `data-layer`; toggle visibility with a class on the SVG (`hide-ink`, `hide-highlights`, `hide-notes`) and CSS rules in `src/index.css`. Hidden layers do not receive eraser hits (check `src/ink/editor.ts` eraser path; skip annotations of hidden layers).
3. Layers popover in `src/ui/ToolTray.tsx` (More group), using switches with `role="switch"` and `aria-checked`.
4. Tour: `src/ui/Tour.tsx` shown by `Reader.tsx` when the `hintSeen` setting is unset (reuse the setting; existing e2e tests that open a page must dismiss or not be blocked by the tour, so make it non-modal for pointer input to the page or dismiss it in a shared e2e helper); focus moves into the dialog, Escape closes, "Skip" always visible. Settings, "Drawing": "Show the tour again".

**Tests:** unit for the eraser skipping hidden layers; e2e `e2e/layers.spec.ts`: draw ink and a highlight, hide Ink: the ink group is not visible and the highlight is; reload: layers visible again; tour shows once, Skip works, keyboard Escape works; 820x1180 and 390x844.

**Acceptance:** toggles respond instantly; the tour fits on a phone screen without scrolling; it never appears twice.

**Security:** none.

**Risks:** none significant.

**Real iPad:** tour readable in both orientations; switches reachable with a finger.

**Size:** S.

---

## M7. Accessibility pass and translation-ready text

**Goal:** PageInk works with VoiceOver, keyboard and large text, meets the European Accessibility Act's practical bar (WCAG 2.1 AA), and every interface string can be translated.

**User-visible result:** no visual redesign; better focus outlines, larger text when the system asks for it, screen reader names everywhere, a "Marks list" alternative to ink for screen reader users (the existing Marks panel lists ink too), and reduced motion respected.

**Tasks**
1. Add dev dependency **`@axe-core/playwright`**. Create `e2e/a11y.spec.ts` that runs axe on Library, Reader (with a sample page), Settings, each sheet and the tour, at 820x1180 and 390x844, failing on `serious` and `critical` issues in **our** UI (exclude the snapshot iframe content: it is the site's page).
2. Fix what it finds in `src/ui/*.tsx` and `src/index.css`: focus-visible styles, contrast with each theme and accent (the accent already computes text contrast; verify), `prefers-reduced-motion`, text sizes in `rem` so they follow browser and iPad text-size settings, dialog focus trapping in `Sheet`.
3. `src/ui/MarksPanel.tsx`: list ink strokes too ("Ink on <nearest text>") so every mark is reachable without seeing it.
4. Create `src/i18n/index.ts` with `t(key, vars?)` and `src/i18n/en.ts` holding all strings. Move strings from `src/ui/*.tsx` and the `MESSAGES` map in `src/import/import-url.ts` into it, file by file. Use `Intl` for dates and plurals (replace the `plural` and `ago` helpers in Settings with `Intl.PluralRules` and `Intl.RelativeTimeFormat`). Set `<html lang>` from the chosen language. CSS uses logical properties (`margin-inline-start`) where you touch layout, so right-to-left works later.
5. Document the result in `docs/ACCESSIBILITY.md` (what was tested, known gaps) for an accessibility statement later.

**Tests:** the axe e2e; existing tests updated only where text moved (same visible text, so they should not change); a unit test that every key in `en.ts` is used and none is missing (simple script over `src/`).

**Acceptance:** keyboard alone can import a page, open it, open the Marks panel, jump to a mark, and change settings; with Chrome text zoom 200% nothing overlaps at 820x1180; axe reports no serious issues.

**Security:** none.

**Risks:** large mechanical diff in UI files; do it one screen per commit with the full gate each time.

**Real iPad:** VoiceOver can operate the library and toolbar; Larger Text setting enlarges app text.

**Size:** M.

---

## M8. Fresh copies: age badge, page history, "what changed"

**Goal:** you always know how old a copy is, can refresh it without losing marks or the old version, and can see what the site changed.

**User-visible result:** page cards and the reader show "Saved 3 weeks ago" (subtle; a stronger badge after 30 days). "Refresh copy" in the More menu keeps the previous version. Page sheet: **History** lists up to 5 versions with dates; **What changed** lists added and removed paragraphs between the current and previous version; any version can be opened read-only. After a refresh, a notice says how many marks could not be found ("2 marks need attention").

**Tasks**
1. `src/store/db.ts`: IndexedDB version 4, store `versions` (`keyPath: 'id'`, index `pageId`). Register migration step `to: 4` (no data to move).
2. `src/store/schema.ts`: `interface PageVersion { id: ID; pageId: ID; capturedAt: ISO; captureMethod; html: string; textHash: string; assets?: string[] }`.
3. `src/import/import-url.ts` `recapturePage`: before overwriting, copy the current snapshot into `versions` (skip if `textHash` is unchanged: then only update `capturedAt`); keep the newest 5 per page; deleting a version releases its assets like `deletePage` (factor the blob-release code from M2 into `releaseAssets(hashes)` in `repo.ts`; the `assets` index must also cover versions, so check references in both `snapshots` and `versions`). Then archive the new copy (M2).
4. Create `src/archive/diff.ts`: `diffBlocks(oldHtml, newHtml)`: split into text blocks (p, li, h1 to h6, td, blockquote), longest-common-subsequence on normalised block text, return `{ added: string[]; removed: string[] }` (cap 200 blocks each).
5. UI: age text in `src/ui/PageCard.tsx` and the reader (use `Intl.RelativeTimeFormat` from M7); History and What changed in `src/ui/Sheets.tsx`; read-only version view by route `/p/<id>/v/<versionId>` in `App.tsx` and `Reader.tsx` (no marking, a banner "Old version from <date>", "Back to current").
6. After refresh, count orphaned marks from the editor and show the notice.
7. `deletePage` deletes versions too.

**Tests:** unit `test/diff.test.ts` (added, removed, reordered, identical); unit for version cap and asset release; e2e `e2e/history.spec.ts`: import (mock v1 HTML), mark, refresh (mock v2 HTML with one paragraph changed): marks kept, History shows 2 entries, What changed shows the paragraph, old version opens read-only.

**Acceptance:** refresh a real news page twice; history shows dates; what changed is readable at phone width; storage figure grows sensibly (shared assets stored once).

**Security:** versions are stored sanitized snapshots; read-only view uses the same viewer and sandbox.

**Risks:** storage growth (cap of 5 versions, shared assets); diff quality on heavily templated pages (accept).

**Real iPad:** refresh, view old version, return.

**Size:** M.

---

## M9. Send to PageInk: capture from your own browser

**Goal:** save the page you are looking at in your own browser (what you see, including pages that block our server) into PageInk.

**User-visible result:** Settings, "Importing": **"Add Send to PageInk to your browser"** with steps for iPad Safari and desktop Chrome (a bookmarklet). Tapping it on any page opens PageInk with a card "Save this page from example.com?" and Save/Cancel. Pictures are then saved by M2 as usual.

**Phase A: spike (max 2 days), report before Phase B**
Build the smallest version and test, on Chrome desktop and real iPad Safari, against 10 sites including one strict-CSP site (for example GitHub) and the shoe retailer that blocks the server. Answer in the report: Does the bookmarklet run under the site's CSP in Safari and Chrome? Does `window.open` + `postMessage` survive the site's and PageInk's Cross-Origin-Opener-Policy? What is the largest page that transfers? Go if it works on at least 7 of 10 sites in both browsers; otherwise ship only the fallback (step 6).

**Tasks (Phase B)**
1. A second Vite entry `receive.html` (add `build.rollupOptions.input` in `vite.config.ts`; add the route to the PWA `navigateFallbackDenylist` if needed) with `src/receive.ts`: on load, `window.opener?.postMessage('pageink-ready', '*')`; on `message`: require `e.source === window.opener`, `e.data.type === 'pageink-page'`, `typeof html === 'string'`, size under 8 MB, `url` http(s) **and** `new URL(url).origin === e.origin` (otherwise refuse); show the confirm card with the origin; on Save call `storePage({ method: 'bookmarklet', ... })` (sanitizes) and start `archivePage`, then go to `/#/p/<id>`.
2. `vercel.json`: a header rule for `/receive.html` setting `Cross-Origin-Opener-Policy: unsafe-none` (only that page; it must still have the strict CSP). Verify which rule wins on Vercel and update `scripts/local.mts` to apply path-specific header rules (today it applies only `headers[0]`).
3. `src/ui/Settings.tsx`: generate the bookmarklet code with the current origin (`location.origin`) and a copy button; short plain-language steps for iPad (bookmark any page, edit its address, paste).
4. The bookmarklet: serialises `document.documentElement.outerHTML` with `<!doctype html>`, opens `<origin>/receive.html`, waits for `pageink-ready` from that origin, posts `{ type: 'pageink-page', url: location.href, title: document.title, html }` to that exact origin.
5. Rate guard: the receive page accepts one page per open and requires the Save tap (a site cannot silently fill your library).
6. Fallback "Download for PageInk" bookmarklet: saves the page as an `.html` file (Blob download) for "Import file".

**Data model / API changes:** `captureMethod: 'bookmarklet'` (already in the type and backup allowlist); new static page `receive.html`; one header rule.

**Tests:** unit `test/receive.test.ts` (message validation: wrong source, wrong type, oversized, origin mismatch, `javascript:` url are refused); e2e `e2e/receive.spec.ts`: a test page on the preview server opens `receive.html` and posts a message; Save creates a page with method `bookmarklet` and no scripts.

**Acceptance:** on desktop Chrome, saving a strict-CSP site and the server-blocked shop works (or the spike report explains why not and the fallback works).

**Security:** content is sanitized like any import; origin of the message must match the claimed URL; explicit user confirmation; COOP relaxed on one static page only; document the change in SECURITY.md.

**Risks:** Safari's handling of bookmarklets under strict CSP and popups; sites with COOP; logged-in images that `/api/asset` cannot fetch (the page keeps their original addresses).

**Real iPad:** install the bookmarklet in Safari, save 5 pages, open them in the PageInk Home Screen app (note: the Home Screen app and Safari share storage only if they are the same origin and iOS allows it; verify and report).

**Size:** M (spike S).

---

## M10. Server cost and abuse guard

**Goal:** server use (fetch, render, asset) cannot run up costs, even across many server instances.

**User-visible result:** none in normal use; when a daily budget is spent, imports fall back to "Import file" with a clear message.

**Tasks**
1. `api/_lib/limits.ts`: `sharedLimiter(key, limit, windowSec)` using the Upstash Redis REST API with plain `fetch` (no new dependency) when `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set; otherwise the existing in-memory limiters. On Upstash error, fall back to in-memory (never fail open to unlimited).
2. Daily global budgets from env: `RENDER_DAILY_BUDGET` (default 300), `ASSET_DAILY_BUDGET` (default 20,000). Over budget: `429` with `BUDGET` code; client message in `src/import/import-url.ts` `MESSAGES`: "PageInk's daily capacity is used up. Try again tomorrow, or save the page and use Import file."
3. Apply in `api/fetch.ts`, `api/render.ts`, `api/asset.ts`.
4. `.env.example` and README settings table: the new variables. SECURITY.md: update known limits 2 and 3.

**Tests:** unit `test/limits.test.ts` with mocked `fetch`: shared path counts, error falls back, budget refusal.

**Acceptance:** with `npm run local` and `RENDER_DAILY_BUDGET=1`, the second render import shows the budget message.

**Security:** tokens only in server env (never `VITE_`).

**Risks:** Upstash latency on each call (one REST call; acceptable).

**Owner action:** create a free Upstash database and set the two variables in Vercel (Decision 7 in the vision).

**Size:** S/M.

---

## M11. AI layer v0 (start of H2)

**Goal:** optional help understanding a page that always cites your marks or the page, with on-device engines where available and cloud only with consent.

**Prerequisite:** owner decision 5 in the vision. Use the `claude-api` skill for current model names and request format; do not hard-code a model ID from memory.

**User-visible result:** Settings, **"AI help"**: Off (default) / On this device only / Cloud (shows exactly what is sent). When on: in the Marks panel, **"Summarise my marks"** (a short summary where every sentence links to the marks it came from) and on a highlight, **"Explain"**. Answers are labelled "AI" and can be saved as a note.

**Tasks**
1. `src/ai/engine.ts`: `interface AiEngine { id; available(): Promise<boolean>; summarize?(input): Promise<AiAnswer>; explain?(input): Promise<AiAnswer> }`, `AiAnswer = { text: string; cites: string[] }` (mark IDs).
2. Engines: `src/ai/none.ts`; `src/ai/chrome.ts` (Chrome built-in Summarizer on desktop, feature-detected; check the current API shape in Chrome's docs); `src/ai/cloud.ts` (calls `/api/ai`).
3. `api/ai.ts`: POST, `checkAccess`, a strict limiter (10 per minute per visitor) and daily budget (M10), input caps (marks text up to 20,000 characters, explain context up to 4,000), key from `ANTHROPIC_API_KEY` env, plain `fetch` to the Messages API, no tools. The system prompt says the page text is untrusted quoted data and to cite mark IDs like `[m3]`; the server strips any citation not in the input. Never log content.
4. UI: `src/ui/MarksPanel.tsx` and `src/ui/NoteCard.tsx` actions; a consent sheet the first time cloud is used; answer sheet with citation chips calling `marksApi.reveal`.
5. Docs: SECURITY.md (what is sent, where, retention), README settings table.

**Tests:** unit for citation filtering, input caps, engine selection; e2e with `/api/ai` mocked: off by default (no buttons), consent required, citations jump to marks.

**Acceptance:** with a real key on localhost, summarising 10 marks gives an answer whose every chip jumps to a real mark; with AI Off, no AI request is ever made (check Network).

**Security:** opt-in, consent per first use, no tools, untrusted-data framing, caps, rate limits, no logging, key server-side only.

**Risks:** cost (budget), wrong answers (citations required; label as AI), Chrome API changes (feature detection).

**Size:** L.

---

## M12. Sync design and local prototype (start of H2)

**Goal:** prove end-to-end encrypted sync between two browsers on localhost before committing to accounts.

**Prerequisite:** owner decision 1 in the vision.

**Tasks**
1. Write `docs/SYNC-DESIGN.md` first (one page, plain language): record-level newest-wins merge using `updatedAt` and soft deletes (already in `Annotation`; add `updatedAt` handling for `Collection` and for page pin/tag edits, fixing the known backup limit in `backup.ts`), a change log store, lazy snapshot/asset sync, encryption with a key derived from a recovery phrase (WebCrypto PBKDF2 + AES-GCM), passkey sign-in later. Get owner approval before step 2.
2. IndexedDB: `changes` store (outbox) written by every repo write (`src/store/repo.ts`, editor saves via `putAnnotation`, restore).
3. `scripts/sync-server.mts`: a tiny local server storing encrypted change blobs per account (memory/file only, localhost only).
4. `src/sync/`: push/pull loop, merge, encryption; Settings, "Sync (experimental)" visible only with `?sync=1`.

**Tests:** unit for merge rules (concurrent edits, delete versus edit, clock skew), encryption round trip; a randomised test of 10,000 operations across two simulated devices ending identical with zero lost marks; e2e with two browser contexts against the local sync server.

**Acceptance:** two Chrome profiles on localhost: marks made offline on both appear on both after reconnecting; the server file contains no readable text.

**Security:** the server never sees plaintext; recovery phrase never leaves the device; threat model added to SECURITY.md.

**Risks:** clock skew (use a hybrid logical clock if tests show problems), storage cost of assets later.

**Size:** L. Not merged into `v2` until the owner approves the design.

---

## M13. Origin-isolated viewer (spike, then decide; start of H2)

**Goal:** show snapshots from a separate origin so a sanitizer bug can never reach the library (SECURITY.md known limit 4).

**Tasks**
1. Inventory: list every place the app reads the snapshot document directly (today `contentDocument`/`contentWindow` appears in `src/viewer/viewer.ts`, `src/viewer/links.ts`, `src/viewer/scrollers.ts`, `src/ink/editor.ts`, `src/ui/Reader.tsx`, `src/ui/ToolTray.tsx`, and indirectly everything in `src/anchor/` and `src/viewer/widgets.ts`). Write `docs/ISOLATED-VIEWER.md`: which code moves into a small trusted "page runtime" served from the second origin, and the message protocol (measure, resolve anchors, hit-test links, caret offsets for the Mark tool, reveal sections, scroll events).
2. Prototype on localhost: serve `viewer-runtime.html` from a second port (for example the preview on 4174); the iframe gets `sandbox="allow-scripts"` **without** `allow-same-origin` (so it is an opaque origin) and the snapshot is passed by `postMessage`; the runtime's own CSP allows only its own script.
3. Measure: time to open a long page, Mark tool latency, ink alignment after rotation, compared with v1. Go if every e2e test passes against the prototype and latency stays within 20% of v1.

**Security:** this is the change that removes the biggest structural risk; the runtime must still never run page scripts (the snapshot's CSP meta tag and DOMPurify stay).

**Risks:** large refactor of anchoring and the Mark tool; message latency during drawing (ink drawing itself stays in the app's canvas, only anchoring crosses the boundary).

**Size:** L. Spike result goes to the owner before any merge.

---

## How to run the plan

**Before starting a milestone**
1. `git checkout v2 && git pull` (never `main`). Optionally `git checkout -b v2-mN-<name>`.
2. Read this milestone, the files it names, and SECURITY.md.
3. Run the gate once to confirm a green start.

**While working**
- Commit in small steps. Every commit passes the gate: `npm run lint && npm test && npm run build && npm run e2e`.
- Commit messages: plain language, what and why. End with the attribution lines required by the session.
- Write any decision you make that this plan did not settle into `docs/DECISIONS.md` (one line, with a "V2" heading).
- If a step turns out impossible or much larger than sized, stop and report instead of improvising a different design.

**Finishing a milestone**
1. Run the acceptance list in Chrome at 820x1180 and 390x844 with `npm run local`.
2. Update `README.md` (features table, known limits), `docs/FEATURES.md` (status) and `SECURITY.md` where relevant.
3. Merge the milestone branch into `v2` (fast-forward or merge commit); do not push to `main`.

**Report to the owner after each milestone (plain language, under 300 words)**
1. What you can now do (one or two sentences, as a user would say it).
2. How to try it: the exact steps on localhost (and on the `v2` preview URL if one exists).
3. Test results: lint, unit count, e2e count on Chromium and WebKit, all green (or what is not and why).
4. What to check on a real iPad (a short checklist from the milestone).
5. Anything that changed in security, storage or cost.
6. Open questions or decisions needed before the next milestone.

**The owner decides** after each report: continue, adjust, or stop. Merging `v2` into `main` happens only when the owner says so, after a full real-iPad pass of [IPAD-CHECKLIST.md](IPAD-CHECKLIST.md).
