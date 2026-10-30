import { describe, expect, test } from 'vitest'
import { clampZ, fitRect, intersects, lerpCam, levelFor, MAX_Z, MIN_Z, panBy, toScreen, toWorld, union, viewRect, visible, zoomAt } from '../src/atlas/camera.ts'

const cam = { x: 100, y: 50, z: 2 }
const vp = { w: 800, h: 600 }

describe('camera', () => {
  test('toWorld undoes toScreen', () => {
    const p = { x: 321, y: 77 }
    const back = toWorld(cam, toScreen(cam, p))
    expect(back.x).toBeCloseTo(p.x)
    expect(back.y).toBeCloseTo(p.y)
  })

  test('zooming around a point keeps the board point under it fixed', () => {
    const s = { x: 250, y: 400 }
    const before = toWorld(cam, s)
    for (const f of [0.5, 1.7, 3]) {
      const after = toWorld(zoomAt(cam, s, f), s)
      expect(after.x).toBeCloseTo(before.x)
      expect(after.y).toBeCloseTo(before.y)
    }
  })

  test('zoom is kept inside its limits, and the point still holds at the limit', () => {
    expect(clampZ(0.001)).toBe(MIN_Z)
    expect(clampZ(99)).toBe(MAX_Z)
    const s = { x: 100, y: 100 }
    const far = zoomAt(cam, s, 1e-6)
    expect(far.z).toBe(MIN_Z)
    expect(toWorld(far, s).x).toBeCloseTo(toWorld(cam, s).x)
  })

  test('panning moves the view by the screen distance, whatever the zoom', () => {
    const next = panBy(cam, 100, -40)
    expect(toScreen(next, { x: cam.x, y: cam.y }).x).toBeCloseTo(100)
    expect(toScreen(next, { x: cam.x, y: cam.y }).y).toBeCloseTo(-40)
  })

  test('fitRect centres the rectangle and leaves the padding', () => {
    const r = { x: 1000, y: 2000, w: 400, h: 200 }
    const c = fitRect(r, vp, 50)
    expect(c.z).toBeCloseTo(Math.min(700 / 400, 500 / 200)) // 1.75, limited by the width
    const tl = toScreen(c, { x: r.x, y: r.y })
    const br = toScreen(c, { x: r.x + r.w, y: r.y + r.h })
    expect(tl.x + br.x).toBeCloseTo(vp.w) // centred sideways
    expect(tl.y + br.y).toBeCloseTo(vp.h) // and up and down
    expect(tl.x).toBeGreaterThanOrEqual(50 - 1e-6)
  })

  test('viewRect is what the camera sees', () => {
    expect(viewRect(cam, vp)).toEqual({ x: 100, y: 50, w: 400, h: 300 })
  })

  test('lerpCam starts and ends exactly, and the zoom moves evenly on a log scale', () => {
    const a = { x: 0, y: 0, z: 0.1 }
    const b = { x: 5000, y: 3000, z: 2 }
    const s = lerpCam(a, b, 0, vp)
    const e = lerpCam(a, b, 1, vp)
    expect(s.x).toBeCloseTo(a.x); expect(s.z).toBeCloseTo(a.z)
    expect(e.x).toBeCloseTo(b.x); expect(e.z).toBeCloseTo(b.z)
    expect(lerpCam(a, b, 0.5, vp).z).toBeCloseTo(Math.sqrt(0.1 * 2))
  })

  test('union, intersects and visible', () => {
    expect(union([])).toBeNull()
    expect(union([{ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 5, w: 10, h: 10 }])).toEqual({ x: 0, y: 0, w: 30, h: 15 })
    expect(intersects({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 5, h: 5 })).toBe(false) // touching edges do not count
    const view = { x: 0, y: 0, w: 100, h: 100 }
    const inside = { x: 10, y: 10, w: 10, h: 10 }
    const near = { x: 140, y: 10, w: 10, h: 10 } // inside the grown margin (50%)
    const far = { x: 900, y: 900, w: 10, h: 10 }
    expect(visible([inside, near, far], view)).toEqual([inside, near])
    expect(visible([near], view, 0)).toEqual([])
  })
})

describe('levelFor (how much of a card to show)', () => {
  test('by width: dot, title, poster', () => {
    expect(levelFor(10)).toBe('dot')
    expect(levelFor(60)).toBe('title')
    expect(levelFor(400)).toBe('poster')
  })

  test('a card does not flicker when it hovers near an edge', () => {
    expect(levelFor(29, 'dot')).toBe('dot') // just past 28, but inside the 12% dead zone
    expect(levelFor(32, 'dot')).toBe('title') // clearly past it
    expect(levelFor(26, 'title')).toBe('title') // just under 28, held
    expect(levelFor(24, 'title')).toBe('dot')
    expect(levelFor(155, 'title')).toBe('title')
    expect(levelFor(170, 'title')).toBe('poster')
    expect(levelFor(140, 'poster')).toBe('poster')
    expect(levelFor(130, 'poster')).toBe('title')
  })

  test('a big jump skips straight over a level', () => {
    expect(levelFor(900, 'dot')).toBe('poster')
    expect(levelFor(5, 'poster')).toBe('dot')
  })
})
