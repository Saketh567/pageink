# Phase 3: Living Marks

Supersedes PLAN.md section 5, Phase 3. Phases 0 to 2 are built; Phase 4 onward is unchanged.

**One sentence:** your marks stop being pixels on top of a page and become things that belong to the page's words, that you can navigate, group by meaning, spotlight, and walk away with as a study sheet.

Phase 2 answered "how does a page get in". Phase 3 answers "what do I do with it once it is here, and why does it feel better than a screenshot".

---

## 1. What you will be able to do (the demo)

1. Swipe the Pencil across a sentence: a **word-exact highlight** appears. Hold still at the end: it grows to the **whole sentence**, hold again: the **whole paragraph**.
2. Pick a **meaning colour** (Important, Question, Idea, Confusing, Issue). The colour carries a name, so your marks are sorted without extra work.
3. Tap an element, write a **note** with Scribble. A small pin sits on the page; the note text lives in a card.
4. Turn on the **Margin lane**: a blank strip beside the page. Handwrite in the margin like a textbook; a thin **leader line** ties each margin scribble to the exact paragraph it belongs to.
5. Open the **Marks panel**: every highlight, note and ink cluster in reading order, filtered by meaning, searchable, tap to jump (page scrolls, mark pulses).
6. Glance at the **heat strip** on the right edge: coloured ticks show where your marks are on the whole page; tap a tick to jump.
7. Tap a highlight and choose **Spotlight**: everything else dims, so you read only what you decided mattered.
8. Tap **Study sheet**: one tap copies or shares all your highlights and notes as clean Markdown, grouped by meaning, with the page link.
9. Rotate the iPad, zoom, close the app, reopen: everything is where you left it, **including your scroll position and tool**.

---

## 2. Key specifications

### 2.1 Anchoring (the foundation everything else stands on)

Stored geometry stays in document space (CSS px at the frozen `layoutWidth`); see PLAN.md section 3.1. Each annotation has up to three anchors, tried in this order when the page loads:

| Order | Anchor | Used by | How it resolves |
|---|---|---|---|
| 1 | `text` (W3C TextQuote + TextPosition) | highlights, notes on words | check `position` and verify `exact`; else find all exact matches, score by prefix/suffix overlap, tie-break by distance to `position.start` |
| 2 | `element` (`css`, `rx`, `ry`) | notes, ink | `querySelector`, then place at relative offset inside the element box |
| 3 | `page` (x, y) | everything | always present; used when 1 and 2 fail |

If 1 and 2 both fail the mark is `orphaned`: drawn dashed at its `page` point, listed in the Marks panel under "Needs attention". Nothing is ever deleted automatically.

Text index: walk body text nodes (skip `script, style, template, noscript`), normalise whitespace runs to one space, keep a node-offset table. Cache per snapshot; rebuild only if the snapshot changes. Highlight rectangles are cached in the annotation but **recomputed from the text anchor on every load and after web fonts finish loading** (`document.fonts.ready` inside the iframe), because font swaps move text.

### 2.2 Data model additions (all optional fields, no migration)

```ts
type Meaning = 'important' | 'question' | 'idea' | 'confusing' | 'issue'

interface Annotation {            // additions to schema.ts
  meaning?: Meaning               // drives colour, grouping, filters
  note?: { text: string; collapsed: boolean }
  highlight?: { rects: Rect[]; scope: 'words' | 'sentence' | 'block' }
  lane?: 'margin'                 // true when the mark lives in the margin lane
  leader?: { to: Anchor }         // margin ink to its target
}
interface Page {                  // additions
  view?: { scrollTop: number; scale: number; tool: string; margin: boolean }
}
```

Meaning palette (name, hex, default highlighter alpha 0.35):

| Meaning | Colour | Typical use |
|---|---|---|
| Important | `#ffd60a` yellow | key claims, definitions |
| Question | `#0a84ff` blue | things to look up or ask |
| Idea | `#34c759` green | things to try or reuse |
| Confusing | `#ff9500` orange | needs a second read |
| Issue | `#ff3b30` red | problems, bugs, UX faults |

Free colours (the Phase 1 palette and custom picker) still work for ink. Meanings apply to highlights and notes.

### 2.3 Tools added to the tray

| Tool | Gesture | Result |
|---|---|---|
| **Mark** (text highlighter) | Pencil drag over text | word-exact highlight, live preview rects while dragging |
| **Mark, dwell-expand** | hold still 450 ms at the end of a drag | word to sentence (Intl.Segmenter) to block; each hold step expands once, with a short pulse |
| **Note** | tap anywhere | pin + card, textarea focused for Scribble |
| **Margin** | toggle | shows the lane; the Pen draws in it |
| **Spotlight** | tap a highlight, then Spotlight | dims everything except that mark; tap outside to exit |

The Phase 1 Pen, Highlighter (freehand) and Eraser stay. The eraser also removes highlights and notes when tapped on them (with undo).

### 2.4 Margin lane

- Lane width 320 doc px, to the right of the page, same background as the viewer (not the white page), so it reads as a notebook margin.
- Off by default. When on, the fit scale uses `layoutWidth + 320`.
- Ink with `x > layoutWidth` gets `lane: 'margin'`. On commit, its anchor is the nearest block element at the stroke's vertical midpoint; a leader line (1.5 px, same colour, 40 percent alpha, gentle curve) is drawn from the stroke's left edge to the element's right edge.
- If the target element moves (re-capture, Phase 8) the leader follows; the margin ink stays put.

### 2.5 Marks panel, heat strip, spotlight

- **Marks panel:** slide-over in portrait, docked at 1024 px and wider. Items in document order. Chips filter by meaning; a search box filters by text. Tap = scroll the item to one-third height, pulse 600 ms. Orphans under "Needs attention".
- **Heat strip:** 14 px wide, right edge of the viewer, height = viewport. One tick per mark, positioned by `y / docHeight`, coloured by meaning; overlapping ticks merge into a taller one. Tap or drag on the strip scrolls the page. Hidden when there are no marks.
- **Spotlight:** a full-document SVG mask with the chosen rects cut out, `rgba(0,0,0,0.65)`, fades in over 150 ms. Tap anywhere or press Escape to exit. Pinch and scroll still work.

### 2.6 Study sheet (export of your thinking, not the page)

Markdown, grouped by meaning in the order Important, Question, Idea, Confusing, Issue, then Notes without a meaning, then Needs attention:

```
# Page title
<url> · captured 2026-10-29 · 14 marks

## Important
> exact highlighted sentence
note text, if any

## Question
> ...
```

Delivered with `navigator.share({ text })` when available, else `navigator.clipboard.writeText`. Ink-only marks appear as `[ink near: "<first words of the anchored element>"]`.

### 2.7 Remember where you were

On every scroll end (debounced 500 ms), tool change, and when the app is hidden, save `Page.view`. On open, restore scroll position and scale before first paint, set the tool, and re-open the Margin lane if it was on.

---

## 3. Tasks (execute in order; each ends with lint, unit tests, e2e green)

### 3A. Foundations

| # | Task | Files | Acceptance criteria |
|---|---|---|---|
| P3.1 | Schema additions (section 2.2) and `Meaning` constants/palette. | src/store/schema.ts, src/ui/state.ts | Lint passes; old stored annotations still load (unit test with a record lacking new fields). |
| P3.2 | `css-selector.ts`: `selectorFor(el)` (`body>tag:nth-of-type(n)` path, prefer unique `#id` unless it looks generated: `/\d{4,}\|[a-f0-9]{8,}\|^:r/`), `resolve(css, doc)`, `elementAnchor(doc, x, y)` returning `{css, rx, ry}`. | src/anchor/css-selector.ts, test | Round-trip over 20 elements of a fixture. |
| P3.3 | `text-quote.ts`: `textIndex(doc)`, `describe(range)` (32-char prefix/suffix + position), `anchor(sel, doc)` (resolution rules in 2.1), `toRange(start, end)`. | src/anchor/text-quote.ts, test | Round-trip on 3 fixtures; still resolves after a paragraph is inserted before the quote; returns null when the text is deleted; duplicate sentences resolve to the right occurrence using context. |
| P3.4 | `anchor.ts`: `resolveAnnotation(a, doc)` applying the order in 2.1 and returning `{rects, orphaned}`. | src/anchor/anchor.ts, test | All three fallbacks covered by unit tests. |
| P3.5 | Ink commit also stores `anchor.element` from the stroke start (reuses P3.2). | src/ink/editor.ts | Stored ink has a resolvable `anchor.element.css`. |
| P3.6 | Re-resolve highlights and notes on load and after `fonts.ready`. | src/viewer/viewer.ts, src/ink/ink-layer.ts | After a simulated font swap that shifts text 12 px, highlight rects follow the words (e2e on a fixture with a late-loading font). |

### 3B. Marking

| # | Task | Files | Acceptance criteria |
|---|---|---|---|
| P3.7 | **Mark tool**: Pencil drag uses `caretRangeFromPoint` from start to current; live rect preview in the SVG; on up save `kind: 'highlight'` with text anchor, rects, scope `words`. Never mutate the snapshot DOM. | src/ink/mark.ts, editor.ts, ToolTray.tsx | Two-line highlight is word-exact; survives reload, rotation, zoom. |
| P3.8 | **Dwell-expand**: hold still 450 ms expands words to sentence (`Intl.Segmenter`, granularity `sentence`) to block (nearest `p, li, blockquote, h1-h6, td`); pulse on each step; release commits. Falls back to block if `Intl.Segmenter` is missing. | src/ink/mark.ts, test | Unit test for sentence expansion on 5 sample paragraphs including abbreviations ("Dr.", "e.g."); on the iPad the hold feels deliberate, not accidental. |
| P3.9 | **Meaning colours**: tray shows the five named meanings when Mark or Note is active; the choice sets colour and `meaning`. | src/ui/ToolTray.tsx, state.ts | Highlights carry `meaning`; colours match 2.2. |
| P3.10 | **Note tool**: tap resolves element + word quote; draws a pin (SVG) and opens a screen-space card with an auto-focused textarea (Scribble). Collapsed = pin only. | src/ui/Note.tsx, ink-layer.ts | Handwriting becomes text via Scribble; the pin stays on its element after rotation; delete and undo work. |
| P3.11 | **Eraser extension**: removes highlights and notes on tap, with undo. | src/ink/eraser.ts, editor.ts | Unit tests for rect hit-testing; undo restores. |

### 3C. Navigation

| # | Task | Files | Acceptance criteria |
|---|---|---|---|
| P3.12 | **Marks panel** (2.5): list, meaning chips, search, orphan section, jump + pulse. | src/ui/MarksPanel.tsx | Every item jumps correctly; list updates live as marks change. |
| P3.13 | **Heat strip** (2.5). | src/ui/HeatStrip.tsx | Ticks at the right heights on a 6000 px page; tap scrolls; merges overlaps. |
| P3.14 | **Spotlight** (2.5). | src/viewer/spotlight.ts | Dims everything except the mark; exits on tap or Escape; scrolling still works. |
| P3.15 | **Layers and clean-read**: toggles for ink, highlights, notes; "Clean read" hides ink and renders highlights as thin underlines. Persisted per page. | src/ui/ToolTray.tsx, viewer.ts | Toggles work and persist. |

### 3D. Margin lane

| # | Task | Files | Acceptance criteria |
|---|---|---|---|
| P3.16 | Viewer supports an optional lane (extra width, fit scale includes it, background colour). | src/viewer/viewer.ts, src/index.css | Toggle changes fit without moving the page's ink; rotation still refits. |
| P3.17 | Margin ink: tag `lane: 'margin'`, find the nearest block element at the stroke's midpoint, store `leader.to`, draw leader lines. | src/ink/margin.ts, ink-layer.ts, test | Leader reaches the right paragraph on 5 fixture cases; moving the anchored element moves the leader end. |

### 3E. Take it with you, and polish

| # | Task | Files | Acceptance criteria |
|---|---|---|---|
| P3.18 | **Study sheet** (2.6). | src/export/study-sheet.ts, test | Unit test: grouped output order, escaping of `>` and backticks, ink-only placeholder. Share sheet or clipboard works on the iPad. |
| P3.19 | **Remember where you were** (2.7). | src/ui/Reader.tsx, store/repo.ts | Close and reopen: same scroll, scale, tool, margin state. |
| P3.20 | Onboarding hints: a 5-card first-run tour (Mark, dwell-expand, Note, Margin, Spotlight) shown once, replayable from Settings. | src/ui/Onboarding.tsx | Appears once; dismissible; replay works. |

---

## 4. Testing

- **Unit (Vitest + jsdom):** selectors, text anchoring (the riskiest logic), sentence expansion, leader target, study sheet, orphan handling, backward compatibility of stored records.
- **E2E (Playwright, Chromium and WebKit):** mark, note, sidebar jump, reload persistence, margin toggle, font-swap re-anchoring. Mouse and `PointerEvent` simulation stand in for the Pencil.
- **Device checklist (add to docs/IPAD-CHECKLIST.md):** dwell-expand timing feels right; Scribble works inside the note card; margin handwriting does not scroll the page; heat strip does not steal Pencil strokes at the right edge; spotlight performance on a long page; study sheet opens the share sheet.

## 5. Risks and decisions to watch

- `caretRangeFromPoint` on iPad Safari inside a same-origin iframe: expected to work (WebKit supports it); verify early in P3.7, and if it fails, hit-test with `elementFromPoint` plus a per-word measuring fallback.
- Mark drags start where the Pencil lands, and Safari's long-press text selection and magnifier must not appear. The container already blocks selection (`user-select: none`); confirm on device.
- Highlight rects depend on fonts and images; the `fonts.ready` re-resolve (P3.6) is the guard. Decide after the iPad run whether to also re-resolve after image loads.
- Margin lane lowers the fit scale (about 0.5 on a 1024 px iPad in landscape for a 1280 page). Consider a phone or tablet layout width when you use it often.
- Leader lines are decoration; if they clutter, a setting to hide them is a two-line change.

## 6. Explicitly not in Phase 3

- AI features (Phase 7), live collaboration (Phase 9), replay and version compare (Phase 8), shape snapping and lasso (Phase 5), search across pages (Phase 5), PDF and image export (Phases 4 and 6).
- Handwriting to text by Claude vision (Phase 7); Phase 3 uses Scribble in the note card only.
