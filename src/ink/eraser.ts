import type { Annotation } from '../store/schema.ts'
import { absPoints } from './stroke.ts'

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

/** Does an eraser of `radius` (doc px) at (x, y) touch this ink annotation? */
export function hitsInk(a: Annotation, x: number, y: number, radius: number): boolean {
  if (!a.ink || a.deleted) return false
  const reach = radius + a.ink.size / 2
  const b = a.ink.bbox
  if (x < b.x - reach || x > b.x + b.w + reach || y < b.y - reach || y > b.y + b.h + reach) return false
  const pts = absPoints(a)
  for (let i = 0; i < pts.length - 1; i++) {
    if (segDist(x, y, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y) < reach) return true
  }
  return false
}
