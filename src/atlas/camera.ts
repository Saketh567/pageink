/**
 * The maths of the endless desk: where a board point is on the screen and back, zooming around a point so the thing under your
 * fingers stays put, fitting a rectangle on screen, and flying between two views. Pure functions, no DOM.
 */
import type { Camera, Rect } from '../store/schema.ts'

export type Pt = { x: number; y: number }
export type Size = { w: number; h: number }

export const MIN_Z = 0.04
export const MAX_Z = 4

export const clampZ = (z: number) => Math.min(MAX_Z, Math.max(MIN_Z, z))

export const toScreen = (c: Camera, p: Pt): Pt => ({ x: (p.x - c.x) * c.z, y: (p.y - c.y) * c.z })
export const toWorld = (c: Camera, s: Pt): Pt => ({ x: s.x / c.z + c.x, y: s.y / c.z + c.y })

/** Zoom by `factor` around the screen point `s`: the board point under `s` does not move. */
export function zoomAt(c: Camera, s: Pt, factor: number): Camera {
  const z = clampZ(c.z * factor)
  const w = toWorld(c, s)
  return { x: w.x - s.x / z, y: w.y - s.y / z, z }
}

/** Slide the view by a screen distance. */
export const panBy = (c: Camera, dx: number, dy: number): Camera => ({ x: c.x - dx / c.z, y: c.y - dy / c.z, z: c.z })

/** The camera that shows `r` centred in a viewport with `pad` screen pixels around it (never zoomed past the limits). */
export function fitRect(r: Rect, vp: Size, pad = 0): Camera {
  const z = clampZ(Math.min((vp.w - 2 * pad) / r.w, (vp.h - 2 * pad) / r.h))
  return { x: r.x + r.w / 2 - vp.w / 2 / z, y: r.y + r.h / 2 - vp.h / 2 / z, z }
}

/** The part of the board the camera sees. */
export const viewRect = (c: Camera, vp: Size): Rect => ({ x: c.x, y: c.y, w: vp.w / c.z, h: vp.h / c.z })

/**
 * Halfway views for a camera flight. The centre moves in a straight line and the zoom moves evenly on a log scale, so a flight from
 * far away to close up speeds through the empty middle instead of crawling at the start.
 */
export function lerpCam(a: Camera, b: Camera, t: number, vp: Size): Camera {
  const z = Math.exp(Math.log(a.z) + (Math.log(b.z) - Math.log(a.z)) * t)
  const ax = a.x + vp.w / 2 / a.z
  const ay = a.y + vp.h / 2 / a.z
  const bx = b.x + vp.w / 2 / b.z
  const by = b.y + vp.h / 2 / b.z
  const cx = ax + (bx - ax) * t
  const cy = ay + (by - ay) * t
  return { x: cx - vp.w / 2 / z, y: cy - vp.h / 2 / z, z }
}

/** The smallest rectangle holding all of `rs`. */
export function union(rs: Rect[]): Rect | null {
  if (!rs.length) return null
  const x1 = Math.min(...rs.map((r) => r.x))
  const y1 = Math.min(...rs.map((r) => r.y))
  const x2 = Math.max(...rs.map((r) => r.x + r.w))
  const y2 = Math.max(...rs.map((r) => r.y + r.h))
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
}

export const intersects = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

/** Cards worth putting on screen: those touching the view, grown by `grow` (a fraction) on every side so panning never shows a gap. */
export function visible<T extends Rect>(items: T[], view: Rect, grow = 0.5): T[] {
  const g: Rect = { x: view.x - view.w * grow, y: view.y - view.h * grow, w: view.w * (1 + 2 * grow), h: view.h * (1 + 2 * grow) }
  return items.filter((i) => intersects(i, g))
}

export type Level = 'dot' | 'title' | 'poster'
const ORDER: Level[] = ['dot', 'title', 'poster']
const EDGES = [28, 150] // on-screen widths where a card changes how much it shows

/**
 * How much of a card to show for its on-screen width. `prev` adds a 12 % dead zone around each edge, so a card does not flicker
 * between two looks while you hold a pinch almost still.
 */
export function levelFor(screenWidth: number, prev?: Level): Level {
  let i = prev ? ORDER.indexOf(prev) : screenWidth < EDGES[0] ? 0 : screenWidth < EDGES[1] ? 1 : 2
  if (prev) {
    while (i < 2 && screenWidth >= EDGES[i] * 1.12) i++
    while (i > 0 && screenWidth < EDGES[i - 1] / 1.12) i--
  }
  return ORDER[i]
}
