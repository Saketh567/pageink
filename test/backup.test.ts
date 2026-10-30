// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, expect, test } from 'vitest'
import { backupFileName, buildBackup, parseBackup, restoreBackup, type Backup } from '../src/store/backup.ts'
import { deletePage, getPage, getSnapshot, listAnnotations, listCollections, putAnnotation, putCollection, putSnapshot, savePage } from '../src/store/repo.ts'
import type { Annotation, Page } from '../src/store/schema.ts'

const T0 = '2026-01-01T00:00:00.000Z'
const page = (id: string, o: Partial<Page> = {}): Page => ({
  id, schemaVersion: 1, url: `https://site.example/${id}`, siteOrigin: 'https://site.example', title: id, captureMethod: 'fetch',
  capturedAt: T0, layoutWidth: 1280, docHeight: 100, textHash: '', tags: [], createdAt: T0, updatedAt: T0, ...o,
})
const ann = (id: string, pageId: string, o: Partial<Annotation> = {}): Annotation => ({
  id, pageId, kind: 'ink', layer: 'ink', color: '#000', anchor: { page: { x: 1, y: 2 } }, createdAt: T0, updatedAt: T0, ...o,
})
const file = (o: Partial<Backup>): Backup => ({ format: 'pageink-backup', version: 1, exportedAt: T0, pages: [], snapshots: [], annotations: [], collections: [], ...o })

describe('backup and restore', () => {
  test('a full round trip brings back pages, copies, marks and collections', async () => {
    await savePage(page('rt'))
    await putSnapshot({ pageId: 'rt', html: '<p>hello backup</p>', sanitizerVersion: 1 })
    await putAnnotation(ann('rt-a', 'rt'))
    await putCollection({ id: 'rt-c', name: 'Round trip', color: '#0a84ff', order: 0, createdAt: T0 })

    const text = JSON.stringify(await buildBackup())
    await deletePage('rt')
    expect(await getPage('rt')).toBeUndefined()

    const summary = await restoreBackup(parseBackup(text))
    expect(summary.pages).toBeGreaterThanOrEqual(1)
    expect((await getPage('rt'))?.title).toBe('rt')
    expect((await getSnapshot('rt'))?.html).toContain('hello backup')
    expect((await listAnnotations('rt')).map((a) => a.id)).toEqual(['rt-a'])
    expect((await listCollections()).map((c) => c.id)).toContain('rt-c')
  })

  test('merging never replaces newer data with older data, and does take newer data', async () => {
    await savePage(page('mg', { title: 'Local newer', updatedAt: '2026-02-01T00:00:00.000Z' }))
    await putAnnotation(ann('mg-a', 'mg', { color: '#local', updatedAt: '2026-02-01T00:00:00.000Z' }))

    await restoreBackup(file({ pages: [page('mg', { title: 'Old backup', updatedAt: '2026-01-01T00:00:00.000Z' })], annotations: [ann('mg-a', 'mg', { color: '#old' })] }))
    expect((await getPage('mg'))?.title).toBe('Local newer')
    expect((await listAnnotations('mg'))[0].color).toBe('#local')

    await restoreBackup(file({ pages: [page('mg', { title: 'Newer backup', updatedAt: '2026-03-01T00:00:00.000Z' })], annotations: [ann('mg-a', 'mg', { color: '#new', updatedAt: '2026-03-01T00:00:00.000Z' })] }))
    expect((await getPage('mg'))?.title).toBe('Newer backup')
    expect((await listAnnotations('mg'))[0].color).toBe('#new')
  })

  test('page copies in a backup file are cleaned again on the way in', async () => {
    const hostile = '<p>ok</p><script>alert(1)</script><img src=x onerror="alert(2)"><a href="javascript:alert(3)">x</a>'
    await restoreBackup(file({ pages: [page('hx')], snapshots: [{ pageId: 'hx', html: hostile, sanitizerVersion: 0 }] }))
    const html = (await getSnapshot('hx'))!.html
    expect(html).toContain('<p>ok</p>')
    expect(html).not.toMatch(/<script|onerror|javascript:/i)
  })

  test('a restore does not touch other pages or delete anything', async () => {
    await savePage(page('keep'))
    await restoreBackup(file({ pages: [page('other')] }))
    expect(await getPage('keep')).toBeDefined()
  })
})

describe('parseBackup rejects bad files whole', () => {
  const good = JSON.stringify(file({ pages: [page('p')], annotations: [ann('a', 'p')] }))

  test('accepts a valid file', () => {
    expect(parseBackup(good).pages).toHaveLength(1)
  })

  test.each([
    ['not json at all', 'hello'],
    ['json of the wrong kind', JSON.stringify({ hello: 1 })],
    ['another app format', JSON.stringify({ ...file({}), format: 'something-else' })],
    ['an array', '[]'],
    ['a missing list', JSON.stringify({ format: 'pageink-backup', version: 1, pages: [] })],
    ['a page without an id', JSON.stringify(file({ pages: [{ title: 'x' } as unknown as Page] }))],
    ['a page whose tags are not a list', JSON.stringify(file({ pages: [{ ...page('p'), tags: 'x' } as unknown as Page] }))],
    ['an annotation without a page', JSON.stringify(file({ annotations: [{ id: 'a' } as unknown as Annotation] }))],
  ])('rejects %s', (_n, text) => {
    expect(() => parseBackup(text)).toThrow('not a PageInk backup')
  })

  test.each([
    ['a javascript: address', { url: 'javascript:alert(1)' }],
    ['a data: address', { url: 'data:text/html,<b>x</b>' }],
    ['an address that is not an address', { url: '::bad' }],
  ])('rejects a page with %s', (_n, patch) => {
    expect(() => parseBackup(JSON.stringify(file({ pages: [{ ...page('p'), ...patch } as Page] })))).toThrow('not a PageInk backup')
  })

  test('rejects an annotation of an unknown kind or without a spot on the page', () => {
    expect(() => parseBackup(JSON.stringify(file({ annotations: [{ ...ann('a', 'p'), kind: 'script' } as unknown as Annotation] })))).toThrow('not a PageInk backup')
    expect(() => parseBackup(JSON.stringify(file({ annotations: [{ ...ann('a', 'p'), anchor: {} } as unknown as Annotation] })))).toThrow('not a PageInk backup')
  })

  test('derives the origin from the address instead of trusting the file, drops a bad cover, and caps long text', () => {
    const p = { ...page('p'), url: 'https://shop.example/a?b=1', siteOrigin: 'https://evil.example', cover: 'javascript:x', title: 'T'.repeat(900), captureMethod: 'weird' } as unknown as Page
    const got = parseBackup(JSON.stringify(file({ pages: [p] }))).pages[0]
    expect(got.siteOrigin).toBe('https://shop.example')
    expect(got.cover).toBeUndefined()
    expect(got.title).toHaveLength(500)
    expect(got.captureMethod).toBe('file')
  })

  test('rejects a copy that is far too large', () => {
    const big = { pageId: 'p', html: 'x'.repeat(8_000_001), sanitizerVersion: 1 }
    expect(() => parseBackup(JSON.stringify({ ...file({ pages: [page('p')] }), snapshots: [big] }))).toThrow('not a PageInk backup')
  })

  test('a backup from a newer version says so', () => {
    expect(() => parseBackup(JSON.stringify({ ...file({}), version: 2 }))).toThrow('newer version')
  })
})

test('backup file names carry the date', () => {
  expect(backupFileName(new Date('2026-10-30T12:00:00Z'))).toBe('pageink-2026-10-30.pageink.json')
})
