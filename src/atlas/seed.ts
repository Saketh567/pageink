/**
 * Turns a library into a first desk: one labelled frame per collection (plus "Loose pages"), with the pages laid out inside as
 * a grid of posters. Pure function so the layout is tested without a database. Every id is derived from the page or collection,
 * so running it again never creates duplicates.
 */
import type { Card, Collection, Page } from '../store/schema.ts'

export const HOME = 'home'
const COLS = 4
const PITCH_X = 360
const PITCH_Y = 470
const FRAME_PAD = 40
const FRAME_HEAD = 90
const FRAME_GAP = 160
const FRAMES_PER_ROW = 3

export const PAGE_W = 320
export const PAGE_H = 420

export const pageCardId = (boardId: string, pageId: string) => `pc-${boardId}-${pageId}`
export const frameCardId = (boardId: string, key: string) => `fr-${boardId}-${key}`

/** Newest first, pinned pages ahead of the rest. */
const order = (a: Page, b: Page) => Number(!!b.pinned) - Number(!!a.pinned) || (b.createdAt > a.createdAt ? 1 : b.createdAt < a.createdAt ? -1 : 0)

export function seedLayout(pages: Page[], collections: Collection[], boardId = HOME): Card[] {
  const groups: Array<{ key: string; label: string; color?: string; pages: Page[] }> = [...collections]
    .sort((a, b) => a.order - b.order)
    .map((c) => ({ key: c.id, label: c.name, color: c.color, pages: pages.filter((p) => p.collectionId === c.id).sort(order) }))
  const known = new Set(collections.map((c) => c.id))
  const loose = pages.filter((p) => !p.collectionId || !known.has(p.collectionId)).sort(order)
  groups.push({ key: 'loose', label: 'Loose pages', pages: loose })

  const out: Card[] = []
  const now = new Date().toISOString()
  let col = 0
  let x = 0
  let y = 0
  let rowHeight = 0
  for (const g of groups.filter((g) => g.pages.length)) {
    const cols = Math.min(COLS, g.pages.length)
    const rows = Math.ceil(g.pages.length / COLS)
    const w = cols * PITCH_X + FRAME_PAD
    const h = rows * PITCH_Y + FRAME_HEAD + FRAME_PAD - 50
    if (col === FRAMES_PER_ROW) { col = 0; x = 0; y += rowHeight + FRAME_GAP; rowHeight = 0 }
    out.push({ id: frameCardId(boardId, g.key), boardId, kind: 'frame', x, y, w, h, z: 0, text: g.label, color: g.color, createdAt: now, updatedAt: now })
    g.pages.forEach((p, i) => {
      out.push({
        id: pageCardId(boardId, p.id), boardId, kind: 'page', pageId: p.id,
        x: x + FRAME_PAD + (i % COLS) * PITCH_X, y: y + FRAME_HEAD + Math.floor(i / COLS) * PITCH_Y,
        w: PAGE_W, h: PAGE_H, z: out.length + 1, createdAt: now, updatedAt: now,
      })
    })
    x += w + FRAME_GAP
    rowHeight = Math.max(rowHeight, h)
    col++
  }
  return out
}

/** Where cards for pages that have none yet go: in a grid to the right of everything already on the board. */
export function placeLoose(missing: Page[], existing: Card[], boardId = HOME): Card[] {
  const right = existing.length ? Math.max(...existing.map((c) => c.x + c.w)) + FRAME_GAP : 0
  const top = existing.length ? Math.min(...existing.map((c) => c.y)) : 0
  const now = new Date().toISOString()
  const z0 = existing.reduce((m, c) => Math.max(m, c.z), 0)
  return [...missing].sort(order).map((p, i) => ({
    id: pageCardId(boardId, p.id), boardId, kind: 'page' as const, pageId: p.id,
    x: right + (i % COLS) * PITCH_X, y: top + Math.floor(i / COLS) * PITCH_Y, w: PAGE_W, h: PAGE_H, z: z0 + i + 1, createdAt: now, updatedAt: now,
  }))
}
