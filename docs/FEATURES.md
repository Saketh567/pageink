# PageInk: core features, specifications, extras

Status: **Done** (shipped and tested), **Next** (planned), **Idea** (not committed to).

## Core features (the product is not PageInk without these)

| # | Feature | Specification | Status |
|---|---|---|---|
| C1 | Import any page | Paste a link or open a file. Cleaned (no scripts) and saved as a frozen copy. Falls back to a rendered copy when a site blocks plain fetching. Importing a page you already have opens that copy. | Done |
| C2 | Faithful, fast reading | Layout fits the screen (iPad gets the tablet design), re-flows on rotation, keeps your place, images load as you approach them. | Done |
| C3 | Pen, highlighter, eraser | Apple Pencil draws; fingers scroll and zoom. Ink stays on the words it was drawn on when the layout changes. | Done (real iPad test pending) |
| C4 | Marks and notes | Highlight a word, sentence or paragraph by meaning (colour); typed notes; margin lane with leader lines. | Done |
| C5 | No login, no key | Visitors just import. Access is limited to this site plus per-visitor rate limits. | Done |
| C6 | Everything stays on the device | Library, ink and marks live in IndexedDB. Backup and restore as a file. | Done |
| C7 | Organise | Collections, tags, sort, grid/list, themes and accent colours. | Done |
| C8 | Dropdowns, FAQs and tabs readable | Tap a header in Read mode to open or close it; "Expand all sections" opens everything; text a site fades in with scripts is shown at once; a mark inside a closed section reopens it. | Done |
| C9 | Move between pages of a site | A link to another page of the same site imports and opens it right away; a "Back to <title>" chip returns. Links to other sites ask first. | Done |
| C10 | Carousels and wide tables | A sideways swipe (or shift+wheel) over a carousel scrolls it. Marks on a slide go with it, are cut off at the carousel's edge, and vanish when their slide is out of sight. | Done |
| C11 | Load the full page | Shops and apps that build their content with scripts: the reader's "Reload with full rendering" button loads the page in a real browser (scrolled top to bottom so lazy images load) and replaces the saved copy; marks are kept. | Done |

## Specifications that apply to every feature
- The app, your library, page text and marks work offline once installed (PWA). Pictures load from the original site, so offline they show only if cached (saving pictures with the page is on the backlog).
- Imported pages never run scripts (security). Interactivity is rebuilt by PageInk, not the site.
- Nothing leaves the device except the page address when importing.
- Touch targets at least 44 px; every control has an accessible name.
- A change ships only after lint, unit tests and e2e (Chromium + WebKit) pass.

## Extra features (backlog, in suggested order)
| Feature | Why | Status |
|---|---|---|
| Whole-site import ("save this section") | Read a multi-page site offline in one go | Next |
| Tab widgets that swap panels (not just open/close) | Pricing tabs, product tabs | Next |
| Clean read: toggle ink / highlights / notes layers | See the page without marks | Next |
| First-run tour | Teach pen, mark, margin in 30 seconds | Next |
| Save pictures with each page (true offline reading)  | Pages look right with no network | Next |
| Search across all your marks and pages | Find that sentence you highlighted | Idea |
| Accounts and cloud sync | Same library on every device | Idea (needs a backend) |
| Export a page with marks as PDF | Share study material | Idea |
| Page history (re-capture and compare) | See what a site changed | Idea |
