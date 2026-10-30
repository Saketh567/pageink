/**
 * Turns pen points into smooth, pressure-aware stroke outlines (perfect-freehand) and back into points.
 */
import { getStroke } from 'perfect-freehand'
import type { Annotation, Rect, Stroke } from '../store/schema.ts'

export interface InkPoint { x: number; y: number; p: number; t: number }

const average = (a: number, b: number) => (a + b) / 2

/** From the perfect-freehand README. */
function pathFromOutline(points: number[][]): string {
  if (points.length < 4) return ''
  let a = points[0]
  let b = points[1]
  const c = points[2]
  let d = `M${a[0].toFixed(2)},${a[1].toFixed(2)} Q${b[0].toFixed(2)},${b[1].toFixed(2)} ${average(b[0], c[0]).toFixed(2)},${average(b[1], c[1]).toFixed(2)} T`
  for (let i = 2; i < points.length - 1; i++) {
    a = points[i]
    b = points[i + 1]
    d += `${average(a[0], b[0]).toFixed(2)},${average(a[1], b[1]).toFixed(2)} `
  }
  return d + 'Z'
}

/** SVG path data (doc space) for a live or committed stroke. Pressure is simulated when the input had none. */
export function outlinePath(points: InkPoint[], tool: Stroke['tool'], size: number): string {
  const real = points.some((pt) => pt.p !== points[0].p)
  const hl = tool === 'highlighter'
  const outline = getStroke(
    points.map((pt) => [pt.x, pt.y, pt.p]),
    { size, thinning: hl ? 0 : 0.6, smoothing: 0.5, streamline: hl ? 0.5 : 0.4, simulatePressure: !real },
  )
  return pathFromOutline(outline)
}

export function buildStroke(
  points: InkPoint[],
  tool: Stroke['tool'],
  size: number,
): { origin: { x: number; y: number }; stroke: Stroke } | null {
  if (points.length < 2) return null
  const o = points[0]
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const bbox: Rect = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }
  const flat = points.flatMap((p) => [p.x - o.x, p.y - o.y, p.p, p.t - o.t])
  return { origin: { x: o.x, y: o.y }, stroke: { tool, size, points: flat, bbox, path: outlinePath(points, tool, size) } }
}

export function absPoints(a: Annotation): InkPoint[] {
  const s = a.ink!
  const out: InkPoint[] = []
  for (let i = 0; i < s.points.length; i += 4) {
    out.push({ x: a.anchor.page.x + s.points[i], y: a.anchor.page.y + s.points[i + 1], p: s.points[i + 2], t: s.points[i + 3] })
  }
  return out
}
