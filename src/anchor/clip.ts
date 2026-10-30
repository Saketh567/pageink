/** Where a mark has to be cut off because the thing it sits on is inside a scrolling or clipped box (a carousel). */
export type Clip = null | 'hidden' | { x: number; y: number; w: number; h: number }

const BIG = 1e6

/**
 * Null when `el` is fully inside every box that clips it; 'hidden' when it has been scrolled completely out of one;
 * otherwise the visible window, in the same coordinates as the element's bounding box.
 */
export function clipOf(el: Element | null): Clip {
  if (!el) return null
  const doc = el.ownerDocument
  const win = doc.defaultView
  if (!win) return null
  let x1 = -BIG, y1 = -BIG, x2 = BIG, y2 = BIG
  let clipped = false
  for (let a = el.parentElement; a && a !== doc.body && a !== doc.documentElement; a = a.parentElement) {
    const s = win.getComputedStyle(a)
    const ox = s.overflowX !== 'visible'
    const oy = s.overflowY !== 'visible'
    if (!ox && !oy) continue
    const b = a.getBoundingClientRect()
    if (ox) { x1 = Math.max(x1, b.left); x2 = Math.min(x2, b.right); clipped = true }
    if (oy) { y1 = Math.max(y1, b.top); y2 = Math.min(y2, b.bottom); clipped = true }
  }
  if (!clipped) return null
  const r = el.getBoundingClientRect()
  if (r.right <= x1 || r.left >= x2 || r.bottom <= y1 || r.top >= y2) return 'hidden'
  if (r.left >= x1 && r.right <= x2 && r.top >= y1 && r.bottom <= y2) return null
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
}
