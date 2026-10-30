// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, expect, test } from 'vitest'
import { inspectHtml } from '../src/import/sanitize.ts'
import { applyFilters, normalizeTags, sortRows, tagCounts, type Row } from '../src/store/organize.ts'
import { deleteCollection, getPage, listCollections, patchPage, putCollection, savePage } from '../src/store/repo.ts'
import type { Page } from '../src/store/schema.ts'

const mk = (id: string, o: Partial<Row> = {}): Row => ({
  id, schemaVersion: 1, url: `https://${id}.example/`, siteOrigin: `https://${id}.example`, title: id, captureMethod: 'fetch',
  capturedAt: '2026-01-01T00:00:00.000Z', layoutWidth: 1280, docHeight: 0, textHash: '', tags: [], notes: 0,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', ...o,
})

describe('applyFilters', () => {
  const rows = [
    mk('alpha', { tags: ['design', 'ux'], collectionId: 'c1', pinned: true, description: 'Pricing page teardown' }),
    mk('beta', { tags: ['design'] }),
    mk('gamma', { collectionId: 'c2', title: 'Gamma Docs' }),
  ]
  const f = (o: Partial<{ query: string; collection: string; tag: string }>) => applyFilters(rows, { query: '', collection: 'all', tag: '', ...o }).map((r) => r.id)

  test('all, pinned, none and a specific collection', () => {
    expect(f({})).toEqual(['alpha', 'beta', 'gamma'])
    expect(f({ collection: 'pinned' })).toEqual(['alpha'])
    expect(f({ collection: 'none' })).toEqual(['beta'])
    expect(f({ collection: 'c2' })).toEqual(['gamma'])
  })
  test('tag filter and search over title, tags, url and description (all words must match)', () => {
    expect(f({ tag: 'design' })).toEqual(['alpha', 'beta'])
    expect(f({ query: 'docs' })).toEqual(['gamma'])
    expect(f({ query: 'teardown pricing' })).toEqual(['alpha'])
    expect(f({ query: 'beta.example' })).toEqual(['beta'])
    expect(f({ query: 'ux', tag: 'design' })).toEqual(['alpha'])
    expect(f({ query: 'nothing matches' })).toEqual([])
  })
})

describe('sortRows', () => {
  const rows = [
    mk('b', { title: 'Beta', updatedAt: '2026-03-01T00:00:00.000Z', notes: 1 }),
    mk('a', { title: 'alpha', updatedAt: '2026-01-01T00:00:00.000Z', notes: 5 }),
    mk('c', { title: 'Charlie', updatedAt: '2026-02-01T00:00:00.000Z', openedAt: '2026-04-01T00:00:00.000Z', notes: 3 }),
  ]
  const order = (s: Parameters<typeof sortRows>[1], r = rows) => sortRows(r, s).map((x) => x.id)
  test('each order, with openedAt winning over updatedAt', () => {
    expect(order('recent')).toEqual(['c', 'b', 'a'])
    expect(order('name')).toEqual(['a', 'b', 'c'])
    expect(order('marks')).toEqual(['a', 'c', 'b'])
    expect(order('site')).toEqual(['a', 'b', 'c'])
  })
  test('pinned pages always come first and the input is not mutated', () => {
    const r = [...rows.slice(0, 2), mk('p', { pinned: true, updatedAt: '2025-01-01T00:00:00.000Z' })]
    expect(order('recent', r)).toEqual(['p', 'b', 'a'])
    expect(r.map((x) => x.id)).toEqual(['b', 'a', 'p'])
  })
})

describe('tags', () => {
  test('tagCounts sorts by count then name', () => {
    expect(tagCounts([mk('a', { tags: ['x', 'y'] }), mk('b', { tags: ['y'] }), mk('c', { tags: ['a'] })])).toEqual([['y', 2], ['a', 1], ['x', 1]])
  })
  test('normalizeTags cleans, dedupes and limits', () => {
    expect(normalizeTags('Design, #UX  research,design')).toEqual(['design', 'ux', 'research'])
    expect(normalizeTags('')).toEqual([])
    expect(normalizeTags('x'.repeat(40))[0]).toHaveLength(24)
    expect(normalizeTags(Array.from({ length: 20 }, (_, i) => `t${i}`).join(' '))).toHaveLength(12)
  })
})

describe('collections storage', () => {
  const page = (id: string, collectionId?: string): Page => ({ ...mk(id, { collectionId }), updatedAt: '2026-01-01T00:00:00.000Z' }) as Page

  test('collections persist in order and patchPage merges without touching updatedAt', async () => {
    await putCollection({ id: 'c2', name: 'Second', color: '#ff9500', order: 2, createdAt: '2026-01-01T00:00:00.000Z' })
    await putCollection({ id: 'c1', name: 'First', color: '#0a84ff', order: 1, createdAt: '2026-01-01T00:00:00.000Z' })
    expect((await listCollections()).map((c) => c.id)).toEqual(['c1', 'c2'])
    await savePage(page('p1', 'c1'))
    await patchPage('p1', { pinned: true, tags: ['x'] })
    const p = await getPage('p1')
    expect(p).toMatchObject({ pinned: true, tags: ['x'], collectionId: 'c1', updatedAt: '2026-01-01T00:00:00.000Z' })
  })

  test('deleting a collection keeps its pages and un-files them', async () => {
    await putCollection({ id: 'cx', name: 'Temp', color: '#34c759', order: 9, createdAt: '2026-01-01T00:00:00.000Z' })
    await savePage(page('p2', 'cx'))
    await savePage(page('p3', 'c1'))
    await deleteCollection('cx')
    expect((await getPage('p2'))?.collectionId).toBeUndefined()
    expect((await getPage('p3'))?.collectionId).toBe('c1')
    expect((await listCollections()).map((c) => c.id)).not.toContain('cx')
  })
})

describe('inspectHtml cover and description', () => {
  test('resolves a relative og:image against the page URL and reads the description', () => {
    const r = inspectHtml('<head><meta property="og:image" content="/img/hero.png"><meta name="description" content="A tidy summary"></head><body>x</body>', 'https://site.example/a/b')
    expect(r.cover).toBe('https://site.example/img/hero.png')
    expect(r.description).toBe('A tidy summary')
  })
  test('ignores non-http covers and missing tags', () => {
    expect(inspectHtml('<head><meta property="og:image" content="data:image/png;base64,AAAA"></head>', 'https://s.example/').cover).toBeUndefined()
    expect(inspectHtml('<body>x</body>').cover).toBeUndefined()
  })
})
