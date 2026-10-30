/**
 * The shapes of everything saved on the device: pages, snapshots, annotations (ink, highlight, note), collections.
 */
export type ID = string
type ISO = string

export interface Rect { x: number; y: number; w: number; h: number }

export interface Page {
  id: ID
  /** 1 = made by version 1; 2 = made by version 2 (pages can carry saved pictures and styles). */
  schemaVersion: 1 | 2
  url: string
  siteOrigin: string
  title: string
  captureMethod: 'fetch' | 'render' | 'file' | 'bookmarklet' | 'pdf'
  capturedAt: ISO
  /** 0 = Auto: laid out at the width of the screen, like the original site; otherwise a fixed width. */
  layoutWidth: number
  docHeight: number
  textHash: string
  versionOf?: ID
  tags: string[]
  template?: 'ux-audit' | 'seo' | 'learning'
  checklist?: Record<string, boolean>
  boardId?: string
  collectionId?: ID
  pinned?: boolean
  /** og:image of the original page, shown as the card cover */
  cover?: string
  description?: string
  openedAt?: ISO
  /** Where you left off, in document pixels, and whether the margin lane was open. */
  view?: { scrollTop: number; margin?: boolean }
  /** Whether the page's pictures, styles and fonts are saved with it (shown on cards; the details are on the snapshot). */
  offline?: 'complete' | 'partial'
  createdAt: ISO
  updatedAt: ISO
}

export interface Collection { id: ID; name: string; color: string; order: number; createdAt: ISO }

export interface Snapshot {
  pageId: ID
  html: string
  sanitizerVersion: number
  /** Hashes of the saved pictures, styles and fonts this page uses (filled when pages are saved complete). */
  assets?: string[]
  /** How completely the page has been saved. */
  archive?: { state: 'none' | 'partial' | 'complete'; saved: number; total: number; bytes: number; at: ISO }
}

/** The readable text of a page, kept apart from its HTML so searching never has to parse pages. */
export interface PageText { pageId: ID; title: string; text: string }

interface Anchor {
  page: { x: number; y: number }
  element?: { css: string; rx: number; ry: number }
  text?: {
    quote: { exact: string; prefix: string; suffix: string }
    position: { start: number; end: number }
  }
}

export interface Stroke {
  tool: 'pen' | 'highlighter' | 'marker'
  size: number
  /** flat [dx, dy, pressure, tMs, ...] relative to anchor.page */
  points: number[]
  path?: string
  bbox: Rect
}

export interface Annotation {
  id: ID
  pageId: ID
  kind: 'ink' | 'highlight' | 'note' | 'shape' | 'ai'
  layer: 'ink' | 'highlights' | 'notes' | 'ai'
  color: string
  anchor: Anchor
  createdAt: ISO
  updatedAt: ISO
  author?: string
  deleted?: true
  orphaned?: true
  ink?: Stroke
  tags?: string[]
  /** Highlights and notes carry a meaning (Important, Question, ...) that sets their colour and grouping. */
  meaning?: 'important' | 'question' | 'idea' | 'confusing' | 'issue'
  /** rects is a cache; it is recomputed from anchor.text whenever the page loads */
  highlight?: { rects: Rect[]; scope: 'words' | 'sentence' | 'block' }
  note?: { text: string }
  /** Margin ink: points at the element it belongs to, so a leader line can be drawn. */
  lane?: 'margin'
  leader?: { css: string; top?: number }
  /** The layout width the ink was drawn at; if the layout changes, ink is moved with the content it was drawn on. */
  layoutAt?: number
}

// ---- Atlas: boards of cards (a spatial desk) ----

/** Where the camera is on a board: (x, y) is the board point at the screen's top-left, z the zoom (1 = true size). */
export interface Camera { x: number; y: number; z: number }

export interface Board {
  id: ID
  name: string
  /** 0 to 360: the board's accent colour. */
  hue: number
  /** Position in the list of boards. */
  order: number
  /** Where you left the camera. */
  camera?: Camera
  createdAt: ISO
  updatedAt: ISO
}

export type CardKind = 'page' | 'quote' | 'note' | 'ink' | 'frame'

/** Anything lying on a board. Position and size are in board units: 1 unit is 1 CSS px at zoom 1, y grows downwards. */
export interface Card {
  id: ID
  boardId: ID
  kind: CardKind
  x: number
  y: number
  w: number
  h: number
  /** Stacking order; frames always sit below everything else. */
  z: number
  /** 'page' cards (and later 'quote' cards): the saved page this card shows. Cards point at pages, they never copy them. */
  pageId?: ID
  /** 'frame' label, 'note' text. */
  text?: string
  /** A frame's colour (from its collection). */
  color?: string
  createdAt: ISO
  updatedAt: ISO
}

export interface Link {
  id: ID
  boardId: ID
  from: ID
  to: ID
  kind: 'thread' | 'source' | 'trail'
  label?: string
  createdAt: ISO
  updatedAt: ISO
}
