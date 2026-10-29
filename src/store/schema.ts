export type ID = string
export type ISO = string

export interface Rect { x: number; y: number; w: number; h: number }

export interface Page {
  id: ID
  schemaVersion: 1
  url: string
  siteOrigin: string
  title: string
  captureMethod: 'fetch' | 'render' | 'file' | 'bookmarklet' | 'pdf'
  capturedAt: ISO
  layoutWidth: number
  docHeight: number
  textHash: string
  versionOf?: ID
  tags: string[]
  template?: 'ux-audit' | 'seo' | 'learning'
  checklist?: Record<string, boolean>
  boardId?: string
  createdAt: ISO
  updatedAt: ISO
}

export interface Snapshot { pageId: ID; html: string; sanitizerVersion: number }

export interface Anchor {
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
}
