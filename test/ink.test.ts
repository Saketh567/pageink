import { expect, test } from 'vitest'
import { hitsInk } from '../src/ink/eraser.ts'
import { createHistory } from '../src/ink/history.ts'
import { buildStroke } from '../src/ink/stroke.ts'
import type { Annotation } from '../src/store/schema.ts'

const pts = [
  { x: 10, y: 20, p: 0.5, t: 1000 },
  { x: 40, y: 50, p: 0.6, t: 1010 },
  { x: 30, y: 10, p: 0.7, t: 1030 },
]

test('buildStroke stores relative points and bbox', () => {
  const r = buildStroke(pts, 'pen', 4)!
  expect(r.origin).toEqual({ x: 10, y: 20 })
  expect(r.stroke.points).toEqual([0, 0, 0.5, 0, 30, 30, 0.6, 10, 20, -10, 0.7, 30])
  expect(r.stroke.bbox).toEqual({ x: 10, y: 10, w: 30, h: 40 })
  expect(r.stroke.path).toMatch(/^M.*Z$/)
})

test('buildStroke ignores a single point', () => {
  expect(buildStroke([pts[0]], 'pen', 4)).toBeNull()
})

const line = (): Annotation => {
  const r = buildStroke([{ x: 0, y: 0, p: 0.5, t: 0 }, { x: 100, y: 0, p: 0.5, t: 10 }], 'pen', 2)!
  return { id: 'a', pageId: 'p', kind: 'ink', layer: 'ink', color: '#000', anchor: { page: r.origin }, ink: r.stroke, createdAt: '', updatedAt: '' }
}

test('eraser hits near the stroke and misses far away', () => {
  expect(hitsInk(line(), 50, 3, 4)).toBe(true)
  expect(hitsInk(line(), 50, 20, 4)).toBe(false)
})

test('eraser ignores deleted strokes', () => {
  expect(hitsInk({ ...line(), deleted: true }, 50, 0, 4)).toBe(false)
})

test('history: add, undo, redo, and a new action clears redo', () => {
  let n = 0
  const h = createHistory()
  const cmd = () => ({ undo: () => n--, redo: () => n++ })
  n++
  h.push(cmd())
  h.undo()
  expect(n).toBe(0)
  expect(h.canRedo()).toBe(true)
  h.redo()
  expect(n).toBe(1)
  h.undo()
  n++
  h.push(cmd())
  expect(h.canRedo()).toBe(false)
})
