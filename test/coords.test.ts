import { expect, test } from 'vitest'
import { clampScale, clientToDoc, zoomScroll } from '../src/viewer/coords.ts'

test('clientToDoc at scale 0.5 with offset', () => {
  expect(clientToDoc(110, 220, { left: 10, top: 20 }, 0.5)).toEqual({ x: 200, y: 400 })
})

test('zoomScroll keeps the focus point fixed', () => {
  expect(zoomScroll({ x: 200, y: 400 }, { x: 100, y: 200 }, 2)).toEqual({ scrollLeft: 300, scrollTop: 600 })
})

test('clampScale bounds', () => {
  expect(clampScale(0.01)).toBe(0.25)
  expect(clampScale(99)).toBe(4)
  expect(clampScale(1)).toBe(1)
})
