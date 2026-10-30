import type { Annotation, Rect } from '../store/schema.ts'
import { elementPoint } from './css-selector.ts'
import { revealAncestors } from '../viewer/widgets.ts'
import { anchorText, rectsOf, textIndex, toRange } from './text-quote.ts'

export interface Resolved { rects: Rect[]; point: { x: number; y: number }; orphaned: boolean }

/**
 * Where an annotation is now. Order: its text quote, then its element, then the page point it was drawn at.
 * If a text-anchored mark cannot be found it is orphaned and shown at its cached position, never deleted.
 */
export function resolveAnnotation(a: Annotation, doc: Document): Resolved {
  const page = a.anchor.page
  if (a.anchor.text) {
    const idx = textIndex(doc)
    const pos = anchorText(idx, a.anchor.text)
    const range = pos && toRange(doc, idx, pos.start, pos.end)
    let rects = range ? rectsOf(range) : []
    // the words exist but are hidden (inside a closed FAQ or dropdown): open that section so the mark can be shown
    if (range && !rects.length && revealAncestors(range.startContainer)) rects = rectsOf(range)
    if (rects.length) return { rects, point: { x: rects[0].x, y: rects[0].y }, orphaned: false }
    return { rects: a.highlight?.rects ?? [], point: page, orphaned: true }
  }
  if (a.anchor.element) {
    const p = elementPoint(doc, a.anchor.element)
    if (p) return { rects: [], point: p, orphaned: false }
  }
  return { rects: a.highlight?.rects ?? [], point: page, orphaned: false }
}
