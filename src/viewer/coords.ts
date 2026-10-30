/**
 * Coordinate maths between the screen and the page, and zoom limits.
 */
export interface Pt { x: number; y: number }

/** Stored geometry lives in document space: CSS px of the snapshot at its layoutWidth. */
export function clientToDoc(cx: number, cy: number, content: { left: number; top: number }, scale: number): Pt {
  return { x: (cx - content.left) / scale, y: (cy - content.top) / scale }
}

export function clampScale(s: number): number {
  return Math.min(4, Math.max(0.25, s))
}

/** Scroll offsets that keep the document point under `focus` (container-relative px) fixed after a zoom. */
export function zoomScroll(docPoint: Pt, focus: Pt, newScale: number): { scrollLeft: number; scrollTop: number } {
  return { scrollLeft: docPoint.x * newScale - focus.x, scrollTop: docPoint.y * newScale - focus.y }
}
