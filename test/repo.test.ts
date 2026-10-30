// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { expect, test } from 'vitest'
import { deletePage, getSnapshot, listAnnotations, listPages, putAnnotation, putSnapshot, savePage, seedSample } from '../src/store/repo.ts'
import type { Annotation, Page } from '../src/store/schema.ts'

const now = '2026-10-29T12:00:00.000Z'
const page = (id: string): Page => ({
  id, schemaVersion: 1, url: '', siteOrigin: 'file:', title: id, captureMethod: 'file', capturedAt: now,
  layoutWidth: 1280, docHeight: 100, textHash: '', tags: [], createdAt: now, updatedAt: now,
})
const ann = (id: string, pageId: string, deleted?: true): Annotation => ({
  id, pageId, kind: 'ink', layer: 'ink', color: '#000', anchor: { page: { x: 1, y: 2 } }, createdAt: now, updatedAt: now, deleted,
})

test('page, snapshot and annotations round-trip; soft-deleted are hidden', async () => {
  await savePage(page('p1'))
  await putSnapshot({ pageId: 'p1', html: '<p>hi</p>', sanitizerVersion: 1 })
  await putAnnotation(ann('a1', 'p1'))
  await putAnnotation(ann('a2', 'p1', true))
  expect((await listPages()).map((p) => p.id)).toContain('p1')
  expect((await getSnapshot('p1'))?.html).toBe('<p>hi</p>')
  expect((await listAnnotations('p1')).map((a) => a.id)).toEqual(['a1'])
})

test('deletePage removes the page, snapshot and annotations', async () => {
  await savePage(page('p2'))
  await putSnapshot({ pageId: 'p2', html: 'x', sanitizerVersion: 1 })
  await putAnnotation(ann('b1', 'p2'))
  await deletePage('p2')
  expect(await getSnapshot('p2')).toBeUndefined()
  expect(await listAnnotations('p2')).toEqual([])
})

test('seedSample only seeds once', async () => {
  let calls = 0
  const f = async () => (calls++, '<p>sample</p>')
  await seedSample(f)
  await seedSample(f)
  expect(calls).toBe(1)
})
