import { describe, expect, test } from 'vitest'
import { frameCardId, pageCardId, placeLoose, seedLayout } from '../src/atlas/seed.ts'
import type { Card, Collection, Page } from '../src/store/schema.ts'

// Behaviour under test: src/atlas/seed.ts, the first layout of a library as frames of posters. No existing tests cover it.
const T = (n: number) => `2026-01-${String(n).padStart(2, '0')}T00:00:00.000Z`
const page = (id: string, day: number, extra: Partial<Page> = {}): Page => ({
  id, schemaVersion: 2, url: `https://s.example/${id}`, siteOrigin: 'https://s.example', title: id, captureMethod: 'fetch', capturedAt: T(day),
  layoutWidth: 0, docHeight: 100, textHash: '', tags: [], createdAt: T(day), updatedAt: T(day), ...extra,
})
const coll = (id: string, order: number, name = id): Collection => ({ id, name, color: '#ff0000', order, createdAt: T(1) })

const overlaps = (a: Card, b: Card) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

describe('seedLayout', () => {
  const pages = [page('a', 1), page('b', 2, { collectionId: 'c1' }), page('c', 3, { collectionId: 'c1' }), page('d', 4, { collectionId: 'c2', pinned: true }), page('e', 5, { collectionId: 'c2' }), page('gone', 6, { collectionId: 'deleted-collection' })]
  const cards = seedLayout(pages, [coll('c1', 1, 'Shoes'), coll('c2', 0, 'Reading')])

  test('one frame per collection that has pages, plus loose pages (including ones whose collection is gone)', () => {
    const frames = cards.filter((c) => c.kind === 'frame')
    expect(frames.map((f) => f.text)).toEqual(['Reading', 'Shoes', 'Loose pages']) // collections in their order, loose last
    expect(frames.map((f) => f.id)).toEqual([frameCardId('home', 'c2'), frameCardId('home', 'c1'), frameCardId('home', 'loose')])
    expect(cards.filter((c) => c.kind === 'page').map((c) => c.pageId).sort()).toEqual(['a', 'b', 'c', 'd', 'e', 'gone'])
  })

  test('a collection with no pages gets no frame', () => {
    expect(seedLayout([page('a', 1)], [coll('empty', 0)]).filter((c) => c.kind === 'frame').map((f) => f.text)).toEqual(['Loose pages'])
  })

  test('pinned pages come first in their frame, then newest first', () => {
    const inReading = cards.filter((c) => c.kind === 'page' && ['d', 'e'].includes(c.pageId!)).sort((a, b) => a.x - b.x)
    expect(inReading.map((c) => c.pageId)).toEqual(['d', 'e']) // d is pinned (older), e is newer
    const inShoes = cards.filter((c) => c.kind === 'page' && ['b', 'c'].includes(c.pageId!)).sort((a, b) => a.x - b.x)
    expect(inShoes.map((c) => c.pageId)).toEqual(['c', 'b']) // newest first
  })

  test('every page card lies inside its frame, and no two page cards overlap', () => {
    const pageCards = cards.filter((c) => c.kind === 'page')
    for (const c of pageCards) {
      const owner = cards.find((f) => f.kind === 'frame' && c.x >= f.x && c.y >= f.y && c.x + c.w <= f.x + f.w && c.y + c.h <= f.y + f.h)
      expect(owner, `card for ${c.pageId} is inside a frame`).toBeDefined()
    }
    for (let i = 0; i < pageCards.length; i++) for (let j = i + 1; j < pageCards.length; j++) expect(overlaps(pageCards[i], pageCards[j])).toBe(false)
    const frames = cards.filter((c) => c.kind === 'frame')
    for (let i = 0; i < frames.length; i++) for (let j = i + 1; j < frames.length; j++) expect(overlaps(frames[i], frames[j])).toBe(false)
  })

  test('ids are derived from the page or collection, so running it again gives the same ids', () => {
    const again = seedLayout(pages, [coll('c1', 1, 'Shoes'), coll('c2', 0, 'Reading')])
    expect(again.map((c) => c.id)).toEqual(cards.map((c) => c.id))
    expect(cards.find((c) => c.pageId === 'a')!.id).toBe(pageCardId('home', 'a'))
  })

  test('frames stay below pages, and pages have their own stacking order', () => {
    expect(cards.filter((c) => c.kind === 'frame').every((c) => c.z === 0)).toBe(true)
    const zs = cards.filter((c) => c.kind === 'page').map((c) => c.z)
    expect(new Set(zs).size).toBe(zs.length)
  })

  test('an empty library gives an empty desk; many frames wrap onto a second row', () => {
    expect(seedLayout([], [])).toEqual([])
    const many = Array.from({ length: 5 }, (_, i) => page(`p${i}`, i + 1, { collectionId: `c${i}` }))
    const frames = seedLayout(many, many.map((p, i) => coll(`c${i}`, i))).filter((c) => c.kind === 'frame')
    expect(new Set(frames.map((f) => f.y)).size).toBe(2) // 3 across, then the next row
  })
})

describe('placeLoose', () => {
  test('new pages go to the right of everything already on the board, without overlapping it', () => {
    const base = seedLayout([page('a', 1)], [])
    const added = placeLoose([page('n1', 7), page('n2', 8)], base)
    const right = Math.max(...base.map((c) => c.x + c.w))
    expect(added.every((c) => c.x >= right)).toBe(true)
    expect(added.map((c) => c.pageId)).toEqual(['n2', 'n1']) // newest first
    expect(added.some((c) => base.some((b) => overlaps(b, c)))).toBe(false)
  })

  test('on an empty board they start at the origin', () => {
    expect(placeLoose([page('n', 1)], [])[0]).toMatchObject({ x: 0, y: 0, kind: 'page' })
  })
})
