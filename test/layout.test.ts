// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { expect, test } from 'vitest'
import { getPage, getSetting, listAnnotations, migrateToAutoLayout, putAnnotation, savePage, setSetting } from '../src/store/repo.ts'
import type { Annotation, Page } from '../src/store/schema.ts'

const T = '2026-01-01T00:00:00.000Z'
const page = (id: string, layoutWidth: number): Page => ({
  id, schemaVersion: 1, url: '', siteOrigin: 'file:', title: id, captureMethod: 'file', capturedAt: T, layoutWidth,
  docHeight: 100, textHash: '', tags: [], createdAt: T, updatedAt: T,
})
const ink = (id: string, pageId: string, o: Partial<Annotation> = {}): Annotation => ({
  id, pageId, kind: 'ink', layer: 'ink', color: '#000', anchor: { page: { x: 1, y: 2 } }, createdAt: T, updatedAt: T, ...o,
})

test('old fixed 1280 pages become Auto, other widths stay, and ink remembers the width it was drawn at', async () => {
  await savePage(page('old-desktop', 1280))
  await savePage(page('old-tablet', 820))
  await putAnnotation(ink('a1', 'old-desktop'))
  await putAnnotation(ink('a2', 'old-tablet'))
  await putAnnotation(ink('a3', 'old-tablet', { layoutAt: 999 })) // already stamped: left alone
  await putAnnotation({ ...ink('h1', 'old-desktop'), kind: 'highlight', layer: 'highlights' }) // only ink needs a width
  await setSetting('defaultWidth', 1280)

  await migrateToAutoLayout()

  expect((await getPage('old-desktop'))?.layoutWidth).toBe(0)
  expect((await getPage('old-tablet'))?.layoutWidth).toBe(820)
  expect((await listAnnotations('old-desktop')).find((a) => a.id === 'a1')?.layoutAt).toBe(1280)
  expect((await listAnnotations('old-tablet')).find((a) => a.id === 'a2')?.layoutAt).toBe(820)
  expect((await listAnnotations('old-tablet')).find((a) => a.id === 'a3')?.layoutAt).toBe(999)
  expect((await listAnnotations('old-desktop')).find((a) => a.id === 'h1')?.layoutAt).toBeUndefined()
  expect(await getSetting('defaultWidth')).toBe(0)
})

test('it runs once: a page a person later sets to a fixed 1280 is not switched back to Auto', async () => {
  await savePage(page('chosen-desktop', 1280))
  await migrateToAutoLayout()
  expect((await getPage('chosen-desktop'))?.layoutWidth).toBe(1280)
})
