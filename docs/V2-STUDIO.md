# PageInk 2: "Atlas"

Studio brief and build spec. Written for the owner first, then precise enough for a builder to execute slice by slice.
Branch `v2`. Replaces the direction of `docs/V2-VISION.md` and `docs/V2-EXECUTION-PLAN.md` for everything you can see and touch. Their invisible foundations (migrations, page text, saved pictures) stay and are reused here.

---

## 1. The name and the pitch

**PageInk Atlas. Your reading, as a map you can walk into.**

Today PageInk is a shelf: a grid of pages, and you open one at a time. Atlas throws the shelf away. When you open the app you are looking down at a dark, quiet desk that goes on forever, and every page you have ever saved is a sheet of paper lying on it. You arrange them with your finger the way you would on a real table: research for the kitchen here, the holiday over there, the article that changed your mind in the middle. Pinch out and the whole map shrinks to glowing titles and coloured clusters. Pinch in on one sheet and it grows, keeps growing, and becomes the page itself, ready for the Pencil, with no screen change and no loading spinner in between. Hold a highlight and peel it off the page like a sticker, then drop it on the desk: now it is a quote card that remembers where it came from. Draw a line from one card to another with the Pencil and they are connected. Every morning the desk washes a few things you marked weeks ago back up to the surface, so what you read actually stays with you. Same private, offline, no-account PageInk underneath; a completely different thing to hold.

### Why this direction (the defence)

PageInk's unfair advantage is that it holds the *real page* and *where your marks sit on it*. Every canvas tool (Muse, Heptabase, Freeform, tldraw, Kinopio) treats a web page as a link or a screenshot; Heptabase is the closest, because highlights in its PDF cards become linked cards on a whiteboard ([Heptabase wiki](https://wiki.heptabase.com/user-interface-logic), [vantaige overview](https://vantaige.io/ai-tool/heptabase)). Nobody lets you zoom continuously from a map of everything you read into a living, markable page and back. Muse proved that a zoomable, Pencil-first board is a good way to think on an iPad ([Muse guide](https://museapp.com/guide), [Ink & Switch on Muse](https://www.inkandswitch.com/muse/)), but Muse has no reader. Atlas joins the two: a spatial map *outside*, the existing high-quality reader *inside*, and the zoom is the door between them. It changes the mental model from "a library of files" to "a place I return to", which is what makes a tool last ten years: places accumulate meaning, lists accumulate clutter. It is also buildable on the web we already have, because the hard part (a faithful sandboxed page with anchored ink) is already done.

### Three rejected alternatives

1. **"Journal": a timeline-first stream (Apple Journal style).** Beautiful and calm, but it is still a list sorted by date. It does not help "easy organisation", and it would feel like v1 with prettier rows. Kept as one *lens* (Time) on the map instead.
2. **"Desk of two": side-by-side reading as the core.** Powerful for study, but it is a feature, not a world. You still need somewhere to come home to. Folded in as slice S8.
3. **"Ask your library": AI-first chat over everything you saved.** Invisible until it works, depends on a server and costs money per question, and it would not *look or feel* different on localhost tomorrow. Atlas makes the data shape (cards, quotes, threads) that a later AI can work on, so nothing is lost by waiting.
4. (Bonus) **A native iPad app rewrite** to get Pencil squeeze and double-tap. Would lose Windows, the web link, and months. Atlas is designed so a thin native wrapper can add those later (see section 6.9).

---

## 2. The mental model and the signature interactions

**The model in one sentence: everything is a card on a board, and a page is a card you can walk into.**

- A **board** is an endless desk. You start with one called *Home*; you can make more (Kitchen, Thesis, Trip).
- A **card** is something lying on a board: a *page* (a saved web page), a *quote* (a highlight peeled out of a page), a *note* (typed or Scribbled text), *ink* (a drawing on the desk), a *frame* (a labelled area that groups cards), or a *portal* to another board.
- A **thread** connects two cards. It can carry a word or two ("contradicts", "try this").
- A **lens** re-arranges the same board for a moment (by time, by site, by meaning, or as the classic shelf) without losing your arrangement.
- The **Tide** brings back a few old marks each day.

### Signature 1: The Dive (zoom into a page)

*Scene, iPad + Pencil.* You are looking at Home from far away: six soft-coloured clusters, each with its name floating above it in large serif type. You pinch out on "Kitchen". The clusters split into individual cards: titles first, then, as you keep pinching, each card turns into a poster with the site's picture, the title, the domain and three tiny coloured bars for your highlights. You keep pinching on "Sourdough at altitude". The other cards slide off the edges; the poster fills the screen; for a quarter of a second the poster and the real page overlap, and then you are simply *on the page*, scrolled to where you left off, your yellow highlights where they were. Pencil writes. Finger scrolls. To leave, pinch inwards on the page (or tap the round "rise" button top-left): the page shrinks back into its poster and the desk comes back around it, exactly where it was.

*Double-tap* a card with a finger does the same in one move (a 420 ms flight).

*Mouse on a PC.* Scroll wheel zooms toward the cursor (like a map). Double-click a card dives. `Esc` or the rise button returns.

### Signature 2: Pull a Quote (peel a highlight out)

*Scene.* You are inside a page. You press and hold a highlighted sentence with the Pencil (or a finger) for 0.4 s. The highlight lifts: it turns into a little strip of paper with a shadow, tilted one degree, following your nib. At the same moment the page shrinks to 86 % and the desk appears around its edges, dimmed. You drag the strip off the page onto the desk and let go. It lands with a tiny settle, becomes a quote card in italic serif, and a thin glowing thread draws itself from the page card to the quote. The page grows back to full size. Later, on the desk, you tap that quote card: the camera flies into the page and the original sentence pulses twice.

*Mouse.* Hold the left button on a highlight for 0.4 s, drag out, release. Also available as "Pull to board" in the marks panel (keyboard and screen-reader path).

### Signature 3: Threads (draw connections with the Pencil)

*Scene.* On the desk, you draw a quick line with the Pencil starting on one card and ending on another. The scribble straightens into a soft hand-drawn curve between their edges and both cards glow briefly in the board's colour. Tap the thread and a small label field appears; write "but see this" with the Pencil (iPad Scribble turns it into text). Move either card and the thread follows. A Pencil stroke that starts and ends on empty desk is just ink on the board: arrows, circles, a doodle. Hold the Pencil still at the end of a stroke for 0.5 s and it snaps to a clean line, box or circle.

*Finger.* Drag the small round knob that appears on the edge of a selected card onto another card. *Mouse.* Same knob, shown on hover.

### Signature 4: The Ring (no toolbar)

*Scene.* Anywhere on the desk or a page, hold the Pencil still on the glass for 0.35 s. A ring of eight soft glass buttons blooms around the nib: pen, highlighter, mark, eraser, note, colour, undo, more. Slide the nib onto one and lift: chosen. After a week you do it without looking, as a flick. On iPads that sense the Pencil hovering, a small ghost dot under the nib shows the current colour and size before you touch the glass. Finger users get a small floating "nib puck" (the current colour) that opens the same ring when tapped; it can be dragged to any edge.

*Mouse.* Right-click opens the ring at the cursor. Keys `P` pen, `H` highlighter, `M` mark, `E` eraser, `N` note.

### Signature 5: Lenses and the Tide

*Lenses.* A small dial at the bottom of the desk: **Map** (your arrangement), **Time** (cards glide into a river from oldest on the left to newest on the right, with month labels), **Sites** (cards gather into islands by website), **Meaning** (quote cards gather by colour: Important, Question, Idea...), **Shelf** (the classic grid, for when you want a list). Every switch is a 520 ms glide of every card from where it is to where it goes. Switching back to Map puts every card exactly back. Nothing is moved for real.

*The Tide.* The first time you open PageInk each day, three quote cards float up from the bottom edge: something you marked yesterday, last week and a month ago. Tap one to dive to it. Flick it down to say "seen". Drag it onto the desk to keep it in view.

---

## 3. Visual identity: "Night desk, lit paper"

The v1 look is beige cards and a toolbar. Atlas is the opposite: a deep, almost black world with a fine dot grid, where pages are bright sheets of paper lit from above, and all controls are frosted glass floating over the desk. The accent colour belongs to the *board*, not the app, and it breathes very slowly. A light world ("Day desk") is a cool porcelain, never beige.

### 3.1 Palette tokens

Put these in a new `src/atlas/atlas.css`, on `:root[data-world="night"]` (default) and `:root[data-world="day"]`. `auto` follows `prefers-color-scheme`.

| Token | Night | Day | Use |
|---|---|---|---|
| `--void` | `#07080C` | `#E8EBF1` | the desk |
| `--void-edge` | `#0E1018` | `#D9DEE8` | radial vignette at the screen edges |
| `--grid` | `#FFFFFF12` | `#0A0F2A17` | dot grid |
| `--grid-major` | `#FFFFFF22` | `#0A0F2A26` | every 8th dot (coarse grid when zoomed out) |
| `--sheet` | `#F3F0E9` | `#FFFFFF` | page and note cards (paper stays light in both worlds) |
| `--sheet-ink` | `#15161B` | `#15161B` | text on paper |
| `--sheet-muted` | `#6E6A62` | `#6B7080` | domain, dates on paper |
| `--glass` | `rgba(20,22,32,0.62)` | `rgba(255,255,255,0.68)` | floating chrome, with `backdrop-filter: blur(24px) saturate(160%)` |
| `--glass-line` | `#FFFFFF1F` | `#0A0F2A1A` | 1px inner border of glass |
| `--text` | `#ECEDF2` | `#0E1020` | text on desk and glass |
| `--muted` | `#8B8FA3` | `#596079` | secondary text |
| `--thread` | accent at 70 % | accent at 80 % | connection lines |
| `--danger` | `#FF6B6B` | `#D93A3A` | delete |

**Board hues (the living accent).** Each board stores a hue. `--accent` is computed as `oklch(0.74 0.16 <hue>)` in Night and `oklch(0.58 0.19 <hue>)` in Day, with a hex fallback for older Safari (`@supports not (color: oklch(0 0 0))`). The six presets and their Night hex:

| Name | Hue | Night hex | Day hex |
|---|---|---|---|
| Ember | 35 | `#FF7A4D` | `#D9481F` |
| Gold | 85 | `#F2C14E` | `#B88300` |
| Moss | 150 | `#5FD48C` | `#1F9A55` |
| Tide | 210 | `#3CC6EE` | `#0A83B8` |
| Iris | 285 | `#9F86FF` | `#6A4DE0` |
| Rose | 355 | `#FF6B93` | `#D23268` |

*Living:* while the board is idle, the hue drifts ±6 degrees over 14 s (`@property --hue` animated, `ease-in-out`, infinite alternate) on the board orb, thread glow and selection rings only. Off under `prefers-reduced-motion`. The vignette is tinted with the accent at 6 %.

**Meanings** (same five as v1, slightly richer so they glow on dark): Important `#FFD43B`, Question `#4DABF7`, Idea `#63E6A2`, Confusing `#FFA94D`, Issue `#FF6B6B`. Highlights on paper are drawn at 38 % opacity, as v1.

### 3.2 Type

Self-hosted woff2 in `public/fonts/` (all SIL Open Font License, from Google Fonts), so they work offline and need no CSP change.

- **Fraunces** (variable: `wght` 300 to 900, `opsz` 9 to 144, `SOFT` 0 to 100): board names, card titles, quote cards (italic), the Dive title. Its optical-size axis is used live: titles get `font-variation-settings: "opsz" <size>` so big labels at far zoom look elegant, not bloated.
- **Geist** (variable 300 to 700): all interface text.
- **Geist Mono** (400): domains, dates, counts.

UI scale (CSS px, line-height in brackets): 12 mono meta (16) · 13 caption (18) · 15 body (22) · 17 lead (24) · 22 panel title, Geist 600 (28) · 30 board name, Fraunces 600 opsz 30 (34) · 44 hero, Fraunces 500 (48) · 64 Dive title flash, Fraunces 400 italic (68).

On cards (world px, at zoom 1): title 26 Fraunces 600, quote 22 Fraunces 400 italic, domain 12 Geist Mono, note 18 Geist.

**Labels that stay readable:** cluster and frame labels are counter-scaled: rendered at `clamp(14px, 28px * z, 28px) / z` world px, so from far away they stay legible while the cards under them shrink to dots.

### 3.3 Space, shape, depth

- Spacing scale (px): 4, 8, 12, 16, 24, 32, 48, 72. Glass panels pad 16; capsules pad 0 18.
- Radius: capsules and puck 999; glass panels 22; page cards 14; note cards 10; quote cards 4 (cut paper) with a fixed tilt from the card id, between -1.6 and +1.6 degrees; frames 28 with a dashed 1.5 px accent border at 35 %.
- Touch targets at least 44 px (ring buttons 52 px).
- **One light, top-left.** Four elevations:
  - `e0` resting: `0 1px 0 #0006, 0 10px 24px -14px #000C` (Day: `#1A214026`, `#1A21404D`)
  - `e1` selected or hovered: `0 18px 44px -18px #000E` plus a 2 px accent ring at 2 px offset
  - `e2` lifted (grabbed or peeled): scale 1.04, rotate +1°, `0 42px 80px -26px #000F`
  - `e3` glass chrome: `0 12px 40px -12px #0009`, plus `inset 0 1px 0 #FFFFFF14`
- Paper grain: a 2 % noise PNG (64 px, tiled) on `--sheet` cards, so they feel like paper not plastic.

### 3.4 Motion

Everything that changes *where* you are moves the camera; nothing slides in from the side like a phone app screen.

| Token | Duration | Easing | For |
|---|---|---|---|
| `--t-snap` | 120 ms | `cubic-bezier(.2,.9,.3,1)` | press, select, toggle |
| `--t-glide` | 240 ms | `cubic-bezier(.22,1,.36,1)` | glass panels, ring bloom (items stagger 14 ms) |
| `--t-peel` | 180 ms | `cubic-bezier(.34,1.56,.64,1)` (slight overshoot) | lift, grab, peel |
| `--t-dive` | 420 ms | `cubic-bezier(.16,1,.3,1)` | camera flights, Dive, rise |
| `--t-lens` | 520 ms | `cubic-bezier(.65,0,.35,1)` | lens re-arrangement (cards stagger by distance, max 120 ms) |
| `--t-settle` | 360 ms | `linear(0, .4 8%, .86 20%, 1.04 34%, 1.01 48%, 1)` | a dropped card settling |

- **Momentum pan:** release velocity decays with friction 0.94 per 16.7 ms frame (time-based: `v *= 0.94 ** (dt/16.7)`), stop below 0.02 px/ms.
- **Wheel zoom:** each notch zooms by 1.12×, eased to target over 160 ms.
- **Reduced motion:** camera flights become 140 ms crossfades; no breathing hue; lens switch is instant with a 120 ms fade.

### 3.5 Iconography

24 px grid, 1.75 px round stroke, round joins, no fills except the colour dot. One family, extended from `src/ui/icons.tsx`: pen, highlighter, mark (a "T" with an underline), eraser, note, thread (two dots joined by a curve), rise (chevron up into a circle), lens (an aperture), tide (two waves), board (three overlapping rounded squares), add (plus in a capsule), search, more. The app icon becomes a single bright sheet tilted on a black desk with an accent-coloured ink stroke crossing it.

---

## 4. Information architecture and screens

```
Atlas (a board)  ── the home and only "screen"
 ├─ Board orb (top-left glass capsule: hue dot + board name) → Boards sheet
 ├─ Find (top-right glass circle, or Cmd/Ctrl+K)  → Find overlay, results fly the camera
 ├─ Add capsule (bottom centre): Paste link · Open file · Note · New frame
 ├─ Lens dial (bottom right): Map · Time · Sites · Meaning · Shelf
 ├─ Nib puck (floating, finger users) → Ring
 ├─ Tide (rises from the bottom once a day)
 └─ Dive (a page card opened in place)
      ├─ the v1 Reader (pages, marks, notes, margin lane, marks panel, heat strip)
      ├─ Rise button (top-left), Ring, Pull a Quote
      └─ S8: a second page beside it
Boards sheet: every board as a live mini-map tile; create, rename, pick hue, reorder, delete
Settings (from Ring → More, or Board orb → Settings): world (Night/Day/Auto), default hue, show classic toolbar, backup/restore, data version
```

Routes (hash, as v1): `#/` → Home board · `#/b/<boardId>` → a board · `#/b/<boardId>/p/<pageId>` → that page dived from that board · `#/p/<pageId>` (v1 links, the Reader's link following) → dive on the current board, creating a card next to the previous page with a "followed link" thread if the page has no card there · `#/settings`. Browser Back rises out of a Dive.

---

## 5. Data model (IndexedDB version 4)

Additive only. No v1 store is changed or emptied. `collections` stay readable (Shelf lens filters, old backups).

### 5.1 New types (`src/store/schema.ts`)

```ts
/** A point and size in board ("world") coordinates: 1 unit = 1 CSS px at zoom 1. y grows downwards. */
export interface Camera { x: number; y: number; z: number } // x,y = world point at the screen's top-left; z = zoom, 0.04..4

export interface Board {
  id: ID
  name: string
  hue: number               // 0..360, the board's living accent
  order: number             // position in the Boards sheet
  camera?: Camera           // where you left it
  parentId?: ID             // a board nested in another (portal card); unused until later
  createdAt: ISO
  updatedAt: ISO
  deleted?: true            // soft delete, purged by a later cleanup step after 30 days
}

export type CardKind = 'page' | 'quote' | 'note' | 'ink' | 'frame' | 'portal'

export interface Card {
  id: ID
  boardId: ID
  kind: CardKind
  x: number; y: number; w: number; h: number   // world units, top-left origin
  z: number                 // stacking order on the board (higher = on top); frames are always below other cards
  pageId?: ID               // kind 'page' (required) and 'quote' (the source page)
  annotationId?: ID         // kind 'quote': the highlight or note it was peeled from
  text?: string             // 'note' text, 'frame' label, 'quote' cached quote (annotation.anchor.text.quote.exact, max 600 chars)
  meaning?: Annotation['meaning'] // 'quote': cached for colour and the Meaning lens
  ink?: Stroke              // 'ink': points relative to (x, y); reuses the v1 Stroke shape
  shape?: 'line' | 'rect' | 'ellipse' // 'ink' snapped by hold-to-snap
  color?: string            // ink colour, note tint
  boardRef?: ID             // 'portal': the board it opens
  createdAt: ISO
  updatedAt: ISO
  deleted?: true
}

export interface Link {
  id: ID
  boardId: ID
  from: ID                  // card id
  to: ID                    // card id
  kind: 'thread' | 'source' | 'trail' // drawn by you | quote → its page (auto) | followed a link (auto)
  label?: string
  bend?: number             // -1..1, curve sideways, taken from the drawn stroke
  color?: string            // default: board accent
  createdAt: ISO
  updatedAt: ISO
  deleted?: true
}
```

Default sizes (world units): page 320 × 420, quote 280 × auto (measured, stored), note 240 × 160, frame grows to fit, portal 220 × 160.

A page can be on several boards (one card per board). An annotation can be peeled more than once (several quote cards). Cards never copy the page or the mark; they *point at* them. The quote's cached `text` and `meaning` are refreshed whenever the source page is opened and the editor reports marks (so an edited note or changed meaning flows back).

### 5.2 Stores and indexes (`src/store/db.ts`, version 3 → 4)

```ts
boards: { key: string; value: Board; indexes: { order: number } }
cards:  { key: string; value: Card;  indexes: { boardId: string; pageId: string; annotationId: string } }
links:  { key: string; value: Link;  indexes: { boardId: string; from: string; to: string } }
```

```ts
if (oldVersion < 4) {
  db.createObjectStore('boards', { keyPath: 'id' }).createIndex('order', 'order')
  const cards = db.createObjectStore('cards', { keyPath: 'id' })
  cards.createIndex('boardId', 'boardId'); cards.createIndex('pageId', 'pageId'); cards.createIndex('annotationId', 'annotationId')
  const links = db.createObjectStore('links', { keyPath: 'id' })
  links.createIndex('boardId', 'boardId'); links.createIndex('from', 'from'); links.createIndex('to', 'to')
}
```

### 5.3 Data step 4 (`src/store/migrate.ts`): "your library becomes your first board"

Quick step (not background; 500 pages is a few hundred puts in one transaction). Safe to run twice because every id is derived:

1. Put board `{ id: 'home', name: 'Home', hue: 210, order: 0 }` if missing.
2. For each collection (by `order`): a frame card `frame-<collectionId>` labelled with the collection name, hue from the collection colour (stored as `color`). Its pages are laid out inside it in a grid of 4 columns, 360 × 470 pitch, newest first.
3. Pages with no collection go in a frame "Loose pages". Pinned pages get the top row of their frame.
4. Frames are placed left to right with 160 units between, wrapping after 3 frames.
5. Page card id: `pc-home-<pageId>`. A card is only put if that id is absent (so a re-run never moves a card you dragged).
6. Board camera: fit all cards with 64 px padding.

Layout maths lives in a pure function `seedLayout(pages, collections): Card[]` (`src/atlas/seed.ts`) so it is unit-tested without a database.

### 5.4 Other repo changes (`src/store/board-repo.ts`, new)

`listBoards`, `putBoard`, `getBoard`, `listCards(boardId)`, `putCards(cards[])` (one transaction), `patchCard`, `listLinks(boardId)`, `putLink`, `deleteCards(ids)` (soft, also soft-deletes their links), `cardsForPage(pageId)`, `cardsForAnnotation(id)`.

Touch `src/store/repo.ts`:
- `deletePage`: soft-delete its cards (`pageId` index) and their links.
- `savePage` callers: a newly imported page gets a card on the current board (done in the Atlas import handler, not in repo).

Touch `src/store/backup.ts`: include `boards`, `cards`, `links` (backup format bumps a minor version; restoring an old backup without them is fine, step 4 re-seeds missing page cards). Shape checks as strict as for annotations: numbers must be finite, `kind` from the known set, ids strings under 128 chars, `text` under 4000 chars, `ink.points` length under 40 000, unknown fields dropped.

---

## 6. Technical approach for the hard parts

### 6.1 The canvas: one transformed layer

```
.atlas (position:fixed; inset:0; overflow:hidden; touch-action:none; background: grid + vignette)
 ├─ .world (position:absolute; left:0; top:0; transform-origin:0 0;
 │          transform: translate3d(-x*z px, -y*z px, 0) scale(z))
 │    ├─ svg.threads (absolute, overflow visible; world coordinates)
 │    ├─ .card[data-card=id] × visible  (absolute; left/top/width/height in world px; contain: layout paint style)
 │    └─ svg.board-ink-live? (no: live ink uses a screen-space canvas, see 6.4)
 ├─ canvas.live (screen space, for strokes in progress)
 ├─ glass chrome (orb, find, add, lens, puck, ring, tide)
 └─ .dive-portal (the Reader, when diving; screen space, NOT inside .world)
```

- `src/atlas/camera.ts` (pure, tested): `toScreen(cam, p)`, `toWorld(cam, s)`, `zoomAt(cam, screenPt, factor)` (keeps the world point under the fingers fixed), `panBy(cam, dx, dy)`, `fitRect(rect, viewport, pad): Camera`, `clampZ(z)` 0.04..4, `viewRect(cam, viewport): Rect`, `lerpCam(a, b, t)` (interpolates `log z` so flights feel even).
- During a gesture the camera lives in a plain object; a single `requestAnimationFrame` loop writes `world.style.transform` and the grid's `background-size: 24*z px` / `background-position`. **No Preact render per frame.** A `camera` signal is updated at most every 100 ms and on settle; that drives culling and level-of-detail re-renders.
- `will-change: transform` on `.world` only while moving; removed 150 ms after settle so Safari re-rasterises text sharply at the new zoom.
- The grid: two background layers (fine every 24 units, major every 192). Fine dots fade out below z 0.35, so far-away views are calm.

### 6.2 Level of detail (semantic zoom)

Per card, from its *on-screen width* `sw = card.w * z` (`src/atlas/lod.ts`, pure, tested):

| Level | On-screen width | What renders |
|---|---|---|
| `dot` | < 28 px | a 10 px rounded square in the frame or page hue; frames show their counter-scaled label |
| `title` | 28 to 150 px | coloured top band, title (Fraunces), favicon letter |
| `poster` | 150 to 700 px | cover image (`loading=lazy decoding=async`), title, domain, date, mark count, the first 3 highlights as coloured strips with their text |
| `dive` | the one card being entered | the Reader in the portal (6.5) |

Hysteresis of 12 % on every boundary so cards do not flicker while you hold a pinch still. The level is bucketed and stored on the element as `data-lod`; CSS shows and hides parts, so a level change is a class change, not a re-mount.

**Never a live iframe on the board.** Live pages exist only in the Dive portal (at most 2, when S8 lands). A screenshot thumbnail is not possible in the browser without running the page, so the `poster` is a *designed* preview made from data we already store (`cover`, `title`, `description`, `siteOrigin`, highlights). It looks intentional, loads instantly and works offline. Cards without a cover get the v1 site gradient (`gradientFor` in `PageCard.tsx`, moved to `src/atlas/hue.ts`).

Highlights for posters: one query per visible poster card, cached in a `Map<pageId, Mark[]>` for the session, cleared when that page is dived (it may change).

### 6.3 Culling and the 200-card budget

- Visible set = cards whose rect intersects `viewRect` grown by 50 % on every side (`src/atlas/cull.ts`, pure, tested). Off-screen cards are not in the DOM.
- At `dot` level, if more than 300 cards are visible, they are drawn into one screen canvas instead of DOM nodes (S2 safety valve; S1 only needs DOM).
- Threads: one `<path>` per link with both ends visible or crossing the view; endpoints computed from card rects (edge-to-edge, `src/atlas/geometry.ts`).
- **Budget (iPad Air M1, Safari, 200 cards, 300 threads, 40 covers):** pan and pinch at 60 fps with a frame under 8 ms of script; board open (IndexedDB read + first paint) under 300 ms; Dive from tap to readable page under 600 ms for a cached snapshot; memory under 250 MB. Checked with a seeded e2e board (6.10).

### 6.4 Pointer routing on the board (`src/atlas/gestures.ts`)

One `pointerdown` handler on `.atlas`. The target card is `event.target.closest('[data-card]')`; threads are hit by a 16 px wide invisible stroke on each path (`pointer-events: stroke`).

| Input | On empty desk | On a card | On a thread |
|---|---|---|---|
| 1 finger drag | pan (momentum) | move card (lifts to `e2` after 6 px) | pan |
| 2 fingers | pinch zoom + pan around the midpoint | same | same |
| finger tap / double-tap | deselect / zoom to fit 1.6× at point | select / Dive | select (label field) |
| Pencil stroke | board ink | starts on card A, ends on card B → thread; ends elsewhere → ink | ink |
| Pencil still 350 ms (< 4 px) | Ring | grab card (then drag moves it) | Ring |
| Pencil hover (`pointerType 'pen'`, `buttons 0`) | ghost nib | show thread knob | highlight thread |
| mouse left drag | pan | move card | pan |
| mouse wheel | zoom at cursor ×1.12 per notch (ctrl/pinch on trackpad same) | same | same |
| shift + wheel | pan | | |
| mouse right-click | Ring | Ring with card actions | Ring with thread actions |
| keyboard | arrows pan, `+`/`-` zoom, `0` fit all, `Enter` dive selected, `Delete` remove, `Tab` moves selection to the nearest card in reading order | | |

Pencil and finger never conflict: as in v1, once a pen is seen, touches from the palm are ignored for 600 ms (`penSeen` logic from `src/ink/pointer.ts`, extracted to a shared `src/ink/palm.ts`). The finger "draw with finger" setting from v1 also applies on the board.

Board ink in progress is drawn on the screen-space `canvas.live` with `perfect-freehand` (already a dependency) using coalesced and predicted events (same code path as `src/ink/live-canvas.ts`); on lift it becomes an `ink` card whose points are stored relative to the card's top-left in world units.

### 6.5 The Dive: a page card becomes the reader without a screen change

The reader is a **portal over the world, not a child of it**. Putting a page iframe inside a CSS-scaled layer would blur its text, break the ink coordinate maths in `src/ink/pointer.ts` (which divides by `viewer.scale` only) and cost a lot. Instead:

1. **Trigger.** Double-tap / double-click / `Enter`, or a pinch release where the card under the pinch midpoint covers more than 72 % of the viewport width.
2. **Mount early.** Create `.dive-portal` at full viewport size, `opacity: 0`, and render the existing `<Reader pageId>` inside it. The Reader lays out at the real screen width, so Auto layout is correct from the first frame.
3. **Fly.** At the same time animate the camera so the card fills the viewport (`fitRect`, `--t-dive`). The portal gets a FLIP transform matching the card's current screen rect, so it moves with the card.
4. **Swap.** When the Reader's host gets `data-ready` (it already sets this), crossfade: poster out, portal in, 180 ms. Then remove the portal's transform (identity) and hide `.world` (`visibility: hidden`, not unmounted, so rising is instant). Input to the Reader is blocked (`pointer-events: none`) until the transform is gone.
5. **Rise.** Rise button, `Esc`, browser Back, or a two-finger pinch-in that ends below 0.8× while the Reader is at its fit scale (watch `viewer.scale` and the zoom gesture in `src/viewer/zoom.ts`; only exit when the page cannot zoom out further). Reverse: show world, FLIP portal back to the card rect, fade to poster, unmount Reader. The Reader's own cleanup already saves the scroll position.

URL: `#/b/<board>/p/<page>`. `App.tsx` stops picking a separate Reader screen; the Atlas reads the route and decides whether a Dive is open. The `key={r}` remount pattern is kept for the Reader inside the portal.

**Reuse.** The Reader, Viewer, ink editor, marks panel, note cards, heat strip, link following, recapture and offline saving are reused as they are. Changes to `Reader.tsx` are small: an optional `onRise` prop, a `chrome="atlas"` prop that hides the v1 ToolTray when the Ring is on (S5), and a hook for Pull a Quote (S3). `followLink` keeps calling `go('/p/<id>')`; the Atlas turns that into "dive into that page here, add a card beside the current one with a `trail` thread".

### 6.6 Pull a Quote mechanics

- `src/ink/editor.ts` already knows which highlight is under a point (it spotlights and reveals them). Add `markAt(docPt): Mark | null` to the editor's returned API.
- In Reader, a press-and-hold (400 ms, < 6 px movement) on a highlight with any pointer, *before* a stroke starts, starts a peel. For the Pencil, the stroke buffer from the Ring hold logic (6.8) is reused: the first 400 ms of a pen-down on a highlight are not committed as ink.
- On peel: a ghost element with the quote text follows the pointer in screen space; the portal animates to `scale(0.86)` (`--t-peel`), revealing the dimmed world behind it. Pointer coordinates for ink are not used during the peel, so the outer scale is harmless; it returns to identity before any drawing.
- Drop outside the portal rect → world point = `toWorld(cam, dropPt)`; create `quote` card (`annotationId`, `pageId`, cached `text`, `meaning`) and a `source` link from the page's card on this board (created if missing). Drop inside → cancel with a 180 ms snap back.
- Tapping a quote card dives to its page and calls `marksApi.reveal(annotationId)` then `spotlight` (both exist in `state.ts`).

### 6.7 Threads geometry

- A Pencil stroke is a thread if it starts inside card A's rect and ends inside card B's rect (B ≠ A), measured in world units, and its length is over 40 units.
- Stored as `from`, `to` and `bend`: the signed distance of the stroke's midpoint from the straight line between the two card centres, divided by that line's length, clamped to -1..1. Rendered as a quadratic curve from edge to edge with control point offset by `bend`. A seeded 1.5 px wobble (from the link id) keeps it hand-drawn; the width tapers 2.5 → 1.5 px.
- Hold-to-snap shapes (S4): if the pen stays still (< 3 px) for 500 ms at the end of a board stroke, fit a line (straightness > 0.96), an ellipse or a rectangle (simple corner detection), and replace the stroke with the clean shape and an `--t-settle` morph.

### 6.8 The Ring

- `src/atlas/Ring.tsx`, used on the board and inside the Reader.
- Pen hold detection (`src/ink/hold.ts`, pure state machine, tested): on pen-down, buffer points; if 350 ms pass with total movement < 4 px, cancel the stroke (nothing is saved, the live canvas is cleared) and open the Ring at the nib. Otherwise flush the buffered points into the stroke as normal; no lag is felt because the live canvas still draws from the first point.
- Marking-menu selection: items at 45° steps, radius 76 px; the selected item is the one whose sector contains the vector from centre to nib once it is beyond 28 px; lift selects. Lifting inside 28 px leaves the Ring open for a tap.
- The colour item opens a second ring of 8 swatches (the v1 `PALETTE`).
- Hover ghost: on `pointermove` with `pointerType === 'pen' && buttons === 0`, show a dot of the current colour and size under the nib. Safari on M2 and later iPad Pros reports the Pencil before it touches the screen ([MacRumors on Safari 16.1](https://www.macrumors.com/2022/10/24/apple-safari-16-1-launch/), [iMore](https://www.imore.com/mac/safari-161-adds-support-for-passkeys-apple-pencil-hover-and-more)). Treat it strictly as an extra; everything works without hover.

### 6.9 What the web cannot do (and the plan for it)

Pencil **double-tap, squeeze and barrel roll** are delivered to native apps through UIKit's Pencil interaction API. We found no sign that Safari passes them to web pages; developers are still asking ([Apple Developer Forums: Apple Pencil Pro events in Mobile Safari](https://developer.apple.com/forums/thread/760238)). Atlas therefore uses *hold-still* for the Ring. If PageInk is ever wrapped in a thin native shell (WKWebView), the shell maps squeeze → open Ring and double-tap → last tool swap, by calling a tiny `window.pageink.ring()` function. Nothing in the web build depends on it.

### 6.10 Persistence

- Card moves, resizes and new cards: written on pointer-up, in one transaction for multi-card moves (`putCards`). Never during a drag.
- Camera: debounced 800 ms after the last change, plus on `pagehide` and before a Dive. Stored on the board record via a field-only patch (like `patchPage`) so it never overwrites a rename made meanwhile.
- Board undo (S3): an in-memory stack of `{ before: Card[]|Link[], after: ... }` operations, 100 deep, with two-finger tap undo and three-finger redo (same gestures as the reader, `attachTapGestures`).
- Lenses compute positions in memory only; nothing is written.

### 6.11 Security

Unchanged rules: imported pages are only ever shown through the existing sanitised, script-less, sandboxed Viewer iframe. The board never renders page HTML; posters use the page's stored plain text fields as text nodes (no `innerHTML`), and cover URLs are only used if `http(s)` (already validated on import; check again in `Poster.tsx`). Quote text is shown as a text node. Backup restore validates the new stores as strictly as the old ones (5.4). No new network calls; fonts are local.

---

## 7. Build plan: slices S1 to S8

Every slice: `npm run lint && npm test && npm run e2e` green, then a manual look in Chrome at 820 × 1180 (iPad portrait), 1180 × 820 (landscape) and 390 × 844 (phone), in Night and Day. "Size": S ≈ half a day, M ≈ a day, L ≈ two days, for one focused builder.

E2E helpers: `e2e/atlas.ts` with `seedBoard(page, n)` (puts n pages and cards through IndexedDB, like `e2e/idb.ts`), `pinch(page, center, factor)` (two touch pointers via CDP in Chromium; in WebKit use `ctrl+wheel`, which both engines treat as zoom), `penStroke(page, points)` (pointerType pen via `page.dispatchEvent`, as `e2e/ink.spec.ts` does).

### S1. "The Atlas": a different product on first launch (L)

**What the owner sees.** `npm run local`, open `http://localhost:4488`. No grid of beige cards: a near-black desk with a fine dot grid and a soft vignette. Every saved page lies on it as a lit paper poster, grouped in labelled frames (one per collection, plus "Loose pages"). A glass capsule top-left says *Home* with a cyan dot. Drag the desk around with a finger or the mouse; pinch or scroll-wheel to zoom from tiny dots with big floating frame names to full posters. Drag a poster to a new place, reload, it stays there. Double-tap (double-click) a poster: the camera flies into it and it *becomes* the page, with all marks and the familiar Pencil tools. Tap the round rise button top-left (or `Esc`): the page shrinks back into its poster on the desk. "Paste link" in the bottom capsule imports a page, and its poster drops onto the desk in the middle of the screen with a settle bounce.

**New files**
- `src/atlas/atlas.css`: tokens (section 3), world, cards, glass, motion.
- `public/fonts/`: `Fraunces-VariableFont.woff2`, `Fraunces-Italic-VariableFont.woff2`, `Geist-VariableFont.woff2`, `GeistMono-Regular.woff2`, plus `OFL.txt`. `@font-face` with `font-display: swap`.
- `src/atlas/camera.ts`, `src/atlas/lod.ts`, `src/atlas/cull.ts`, `src/atlas/geometry.ts` (pure).
- `src/atlas/seed.ts` (`seedLayout`).
- `src/store/board-repo.ts`.
- `src/atlas/Atlas.tsx` (board screen: loads board + cards, owns camera loop, chrome, Dive state, import capsule).
- `src/atlas/CardView.tsx` (page card with `data-lod` parts), `src/atlas/Poster.tsx`, `src/atlas/hue.ts` (gradient + hue helpers moved from `PageCard.tsx`).
- `src/atlas/gestures.ts` (S1 subset: finger/mouse pan, pinch, wheel, card drag, double-tap; Pencil press-hold grab; Pencil does nothing else on the board yet).
- `src/atlas/Dive.tsx` (portal, FLIP, swap, rise).

**Touch**
- `src/store/schema.ts` (Board, Card, Link, Camera), `src/store/db.ts` (version 4), `src/store/migrate.ts` (step 4).
- `src/store/repo.ts` (`deletePage` soft-deletes cards).
- `src/store/backup.ts` (include and validate boards, cards, links).
- `src/ui/App.tsx` (routes → `Atlas`; `/settings` stays; `/shelf` → v1 `Library` for now).
- `src/ui/Reader.tsx` (`onRise` prop; nothing else).
- `src/ui/appearance.ts` (world `night|day|auto` → `data-world`; v1 themes stay inside the Reader for now).
- `src/main.tsx` (import `atlas.css`).

**Tests**
- Unit: `test/camera.test.ts` (zoomAt keeps the focus point fixed, fitRect, clampZ, toWorld∘toScreen = identity), `test/lod.test.ts` (levels and hysteresis), `test/cull.test.ts`, `test/seed.test.ts` (frames per collection, no overlaps, pinned first, deterministic ids), `test/migrate.test.ts` (extend: step 4 creates Home and cards; running it twice changes nothing; a moved card is not moved back), `test/backup.test.ts` (extend: round-trip boards/cards/links; hostile values rejected).
- E2E `e2e/atlas.spec.ts` (Chromium + WebKit): first launch shows `.atlas` with the sample page as a card; drag a card, reload, same position; wheel zoom changes `data-lod` from `poster` to `title` to `dot`; double-click card → Reader `data-ready` visible and URL `#/b/home/p/<id>`; `Esc` → back on the board, card visible; import from the bottom capsule (local API) adds a card in view. Update `e2e/library.spec.ts` and `e2e/organize.spec.ts` to open `#/shelf`.
- **Acceptance at 820 × 1180:** frames readable at fit-all; poster text crisp after a zoom settles; Dive and rise without a white flash; rise returns to the same camera. **At 390 × 844:** chrome fits in one row top and one bottom; posters reachable by pinch; Dive fills the phone.

### S2. "Worlds and boards" (M)

**Sees.** Settings → World: Night, Day, Auto; the desk flips from black to porcelain with paper staying bright. Tap the *Home* orb: the Boards sheet shows each board as a mini-map. Make "Kitchen", pick Ember: the whole board glows orange-red, slowly breathing. Long-press a card → "Move to board…". Momentum pan, smooth wheel zoom, the grid that fades when far away. Continuous pinch-to-dive (no double-tap needed).

**Files.** New `src/atlas/Boards.tsx`, `src/atlas/momentum.ts`. Touch `Atlas.tsx`, `gestures.ts` (momentum, pinch-dive threshold), `atlas.css` (Day world, breathing hue), `board-repo.ts` (move card), `Settings.tsx` (World, default hue).
**Tests.** Unit `momentum.test.ts` (decay, stop threshold). E2E: create board, switch, card moved to it disappears from Home; Day world sets `data-world="day"`; pinch past 72 % dives (Chromium CDP touch; WebKit ctrl+wheel).
**Acceptance.** Mini-maps render under 100 ms for 10 boards; contrast of `--muted` on `--void` ≥ 4.5:1 in both worlds.

### S3. "Pull a Quote" (M)

**Sees.** Inside a page, hold a highlight: it peels off, the page shrinks to show the desk; drop it, a quote card appears with a glowing thread to its page. Tap the quote: fly back into the page, the sentence pulses. Two-finger tap undoes on the board too.

**Files.** New `src/atlas/QuoteCard.tsx`, `src/atlas/peel.ts`, `src/atlas/Threads.tsx` (render `source` links), `src/atlas/history.ts`. Touch `src/ink/editor.ts` (`markAt`), `src/ink/pointer.ts` (pre-stroke hold buffer shared with S5), `Reader.tsx` (peel hook), `Dive.tsx` (shrink to 0.86), `MarksPanel.tsx` ("Pull to board").
**Tests.** Unit `peel.test.ts` (hold threshold, cancel inside), `history.test.ts`. E2E: make a highlight with the Mark tool (as `marks.spec.ts`), hold and drag outside → quote card + link stored; tap quote → Reader open and spotlight set; undo removes the card.
**Acceptance.** No ink dot left behind after a peel; peel works with mouse on PC.

### S4. "Threads and desk ink" (M)

**Sees.** Draw with the Pencil on the desk: ink stays. Draw from one card to another: a thread. Tap a thread, write a label. Hold at the end of a stroke: it snaps to a line, box or circle. Following a link inside a page adds the new page beside the old one with a dotted "trail" thread.

**Files.** New `src/atlas/board-ink.ts`, `src/atlas/snap.ts`, `src/atlas/ThreadLabel.tsx`. Touch `gestures.ts`, `Threads.tsx`, `Atlas.tsx` (route `/p/<id>` → trail), `src/ink/palm.ts` (extracted from `pointer.ts`).
**Tests.** Unit `snap.test.ts` (line/rect/ellipse fits on synthetic strokes), `geometry.test.ts` (thread detection, bend). E2E: pen stroke card→card makes a link; empty→empty makes an ink card; follow a same-site link → trail link exists.

### S5. "The Ring" (M)

**Sees.** No toolbar anywhere. Hold the Pencil still: the ring blooms; flick to a tool. The nib puck for fingers. Right-click on PC. With hover-capable Pencils, a ghost dot. Settings → "Show classic toolbar" brings v1's ToolTray back for those who want it.

**Files.** New `src/atlas/Ring.tsx`, `src/ink/hold.ts`, `src/atlas/NibPuck.tsx`. Touch `Reader.tsx` (`chrome="atlas"`), `ToolTray.tsx` (render only when the setting is on), `pointer.ts` (use `hold.ts`), `state.ts` (`showTray` signal).
**Tests.** Unit `hold.test.ts` (350 ms / 4 px, flush vs cancel). E2E: pen down still 400 ms → ring visible; move toward "highlighter" and up → `tool.value` is highlighter (read through a test hook); right-click opens ring; keyboard `H` works.
**Acceptance.** A normal fast stroke never opens the ring; a dot (tap) still draws a dot.

### S6. "Lenses and Find" (M)

**Sees.** The lens dial: Time makes a river of months, Sites makes islands, Meaning gathers quote cards by colour, Shelf shows the classic grid. Map puts everything back. Cmd/Ctrl+K or the magnifier: type a word, results list pages and quotes (uses the `texts` store from M1); tapping one flies the camera there.

**Files.** New `src/atlas/lenses.ts` (pure layouts), `src/atlas/LensDial.tsx`, `src/atlas/Find.tsx`. Touch `Atlas.tsx` (FLIP all cards on lens change), `App.tsx` (`/shelf` becomes the Shelf lens).
**Tests.** Unit `lenses.test.ts` (time order, site grouping, no overlaps, Map restores stored positions). E2E: switch to Time and back, positions unchanged in IndexedDB; Find flies the camera (card in viewport).

### S7. "The Tide" (S)

**Sees.** First open of the day: three quote cards rise from the bottom (yesterday, a week ago, a month ago). Tap dives; flick down dismisses; drag onto the desk keeps one.

**Files.** New `src/atlas/tide.ts` (pick: annotations with highlight or note, prefer ones not shown in 14 days, one per age band; state in settings key `tide` `{ date: 'YYYY-MM-DD', shown: Record<annotationId, ISO> }`), `src/atlas/Tide.tsx`. Touch `Atlas.tsx`.
**Tests.** Unit `tide.test.ts` with a fixed clock. E2E: seed three old marks, open → tide shows 3; reload same day → not shown again.

### S8. "Side by side" (L)

**Sees.** Drag a second card onto the edge of an open page: the screen splits, two pages scroll independently, and a Pencil line from a sentence on the left to one on the right creates a thread between their quote cards (peeled automatically). On phone width it becomes a swipe between the two.

**Files.** Touch `Dive.tsx` (two portals, divider), `Reader.tsx` (accept a host size), `peel.ts` (cross-portal stroke). New `src/atlas/Split.tsx`.
**Tests.** E2E: open two pages, both `data-ready`; cross stroke creates two quote cards and one link.
**Risk to watch.** Two live viewers on an older iPad: measure memory before polishing.

---

## 8. Keep and drop

**Keep (as is, behind the new surface):** import (link, file, full rendering), the sanitiser and sandbox, the Viewer and Auto layout, pen/highlighter/eraser/Mark/notes, the margin lane, anchoring, the marks panel, the heat strip, the study sheet, offline saving of pictures, backup and restore, the migration runner, the `texts` search store, palm rejection, two- and three-finger undo/redo, same-site link following and the Back chip.

**Drop deliberately:**
- The library grid as home (it survives only as the Shelf lens).
- The fixed toolbar (Ring by default; classic toolbar is an opt-in setting).
- The four v1 themes (light, dark, paper, auto) as the main look; replaced by Night/Day worlds and board hues. Paper stays as the Reader's page backdrop option.
- Collections as the main way to organise (they become frames on first run and remain readable, but new organisation happens with boards and frames).
- Sort menus and grid/list toggles (replaced by lenses).
- `Page.boardId` (an unused v1 field): left in place, never written; cards are the truth.

---

## 9. Five delightful details nobody asked for

1. **Ink that dries.** A fresh stroke is slightly glossy (a 1 px lighter inner line) and "dries" to matte over 900 ms. Purely visual, and it makes the Pencil feel wet.
2. **Pages remember the weather.** A page card's top band is tinted by the dominant colour of its cover image (sampled once on a 16 px canvas from the saved blob, only when the picture is saved locally), so a board of recipes looks warm and a board of space articles looks deep blue without anyone choosing colours.
3. **The desk keeps a footprint.** Where a card has been lying for a long time, a very faint paper-shadow stays on the grid for a few seconds after you move it, as on a real desk.
4. **Titles breathe with distance.** Fraunces' optical-size and softness axes follow the zoom: far away, frame names are soft and wide; up close, card titles turn crisp and tight. One font, continuously re-cut by distance.
5. **"Where was I?" glow.** The page card you dived into last has a slow pulsing edge in the board colour for the rest of the day, so coming back to the app you always see your place first. The camera opens framed on it.

---

## 10. Risks and how to test them early

| Risk | Why it matters | Test early (in S1 unless noted) |
|---|---|---|
| Safari blurs text in a scaled layer | posters look cheap | toggle `will-change` only while moving; e2e screenshot after settle at z 0.5, 1, 2; real iPad check in the iPad checklist |
| Pinch fights the Reader's own zoom | can't leave a page, or leave by accident | rise only when `viewer.scale` is at fit and the pinch ends < 0.8×; e2e both directions; manual on iPad |
| 200 cards drop frames on older iPads | feels sluggish, kills the magic | `seedBoard(page, 200)` e2e with a Performance trace: script per frame < 8 ms during a scripted pan; culling unit tests |
| Pencil hold-still steals real dots and strokes | drawing feels broken | `hold.test.ts` with recorded real stroke timings from `?debug=1` logs; manual "write a full stop" test |
| Migration to v4 on a big library | first launch slow or wrong | migrate test with 500 pages and 12 collections under 1 s in fake-indexeddb; run twice; moved cards stay |
| Backup and restore lose the arrangement | data loss | backup round-trip test in S1; restore of a v1 backup re-seeds cards |
| Dive flash (white frame between poster and page) | breaks the illusion | portal mounts at opacity 0 first; swap only on `data-ready`; e2e asserts no frame where both are hidden (poll every rAF in a test hook) |
| WebKit e2e cannot do touch pinch | untested path | use `ctrl+wheel` zoom in WebKit (same `zoomAt` code), CDP touch in Chromium; manual iPad pass per slice |
| Owner finds it confusing at first | a beautiful but lost user | first-run: the camera starts zoomed to the "Loose pages" frame and a single glass hint reads "Pinch a page to step inside". Hide forever after the first Dive |
| Fonts add weight | slow first load | four woff2 files under 450 KB total, cached by the service worker; `font-display: swap` |

---

### Sources

- Heptabase: [User Interface Logic](https://wiki.heptabase.com/user-interface-logic), [changelog](https://wiki.heptabase.com/changelog), [vantaige overview](https://vantaige.io/ai-tool/heptabase) (highlights from PDFs become linked cards on whiteboards).
- Muse: [Guide to Muse](https://museapp.com/guide), [Ink & Switch: Muse](https://www.inkandswitch.com/muse/), [Muse 1.5 Flex boards](https://museapp.com/memos/2021-03-flex-boards) (zoomable, nested boards, ink anywhere).
- Apple Pencil on the web: [MacRumors: Safari 16.1 adds Apple Pencil hover](https://www.macrumors.com/2022/10/24/apple-safari-16-1-launch/), [iMore](https://www.imore.com/mac/safari-161-adds-support-for-passkeys-apple-pencil-hover-and-more), [Apple Developer Forums: Apple Pencil Pro events in Mobile Safari](https://developer.apple.com/forums/thread/760238), [MDN: PointerEvent.pointerType](https://developer.mozilla.org/docs/Web/API/PointerEvent/pointerType), [DEV: Apple Pencil pressure and coalesced events](https://dev.to/sendotltd/reading-apple-pencil-pressure-in-the-browser-pointerevent-getcoalescedevents-and-the-2e23).
- Design references used from general knowledge, not fetched for this brief: tldraw and perfect-freehand (already a PageInk dependency), Apple Freeform, Kinopio, Arc, marking menus (Kurtenbach and Buxton).
