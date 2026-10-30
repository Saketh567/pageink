import { getDb } from './db.ts'
import type { Annotation, Collection, ID, Page, Snapshot } from './schema.ts'

export const SAMPLE_ID = 'sample'

export async function savePage(p: Page) {
  await (await getDb()).put('pages', p)
}
/** Merge fields into a page. Does not touch updatedAt unless the patch carries it. */
export async function patchPage(id: ID, patch: Partial<Page>) {
  const p = await getPage(id)
  if (p) await savePage({ ...p, ...patch })
}
export async function getPage(id: ID) {
  return (await getDb()).get('pages', id)
}
/** Newest first. */
export async function listPages() {
  return (await (await getDb()).getAllFromIndex('pages', 'updatedAt')).reverse()
}
export async function countAnnotations(pageId: ID) {
  return (await listAnnotations(pageId)).length
}
export async function putSnapshot(s: Snapshot) {
  await (await getDb()).put('snapshots', s)
}
export async function getSnapshot(pageId: ID) {
  return (await getDb()).get('snapshots', pageId)
}
export async function putAnnotation(a: Annotation) {
  await (await getDb()).put('annotations', a)
}
/** Live annotations only; soft-deleted ones stay in the store for undo and sync. */
export async function listAnnotations(pageId: ID) {
  const all = await (await getDb()).getAllFromIndex('annotations', 'pageId', pageId)
  return all.filter((a) => !a.deleted)
}
export async function deletePage(id: ID) {
  const db = await getDb()
  const tx = db.transaction(['pages', 'snapshots', 'annotations'], 'readwrite')
  const keys = await tx.objectStore('annotations').index('pageId').getAllKeys(id)
  await Promise.all([
    tx.objectStore('pages').delete(id),
    tx.objectStore('snapshots').delete(id),
    ...keys.map((k) => tx.objectStore('annotations').delete(k)),
    tx.done,
  ])
}

export async function getSetting<T>(key: string): Promise<T | undefined> {
  return ((await (await getDb()).get('settings', key)) as { value: T } | undefined)?.value
}
export async function setSetting(key: string, value: unknown) {
  await (await getDb()).put('settings', { key, value })
}

/** First run: store the bundled sample article so there is something to draw on. */
export async function seedSample(fetchHtml: () => Promise<string>) {
  if (await getPage(SAMPLE_ID)) return
  const html = await fetchHtml()
  const now = new Date().toISOString()
  await savePage({
    id: SAMPLE_ID, schemaVersion: 1, url: '', siteOrigin: 'file:', title: 'How a web page works (sample)',
    captureMethod: 'file', capturedAt: now, layoutWidth: 0, docHeight: 0, textHash: '', tags: [], createdAt: now, updatedAt: now,
  })
  await putSnapshot({ pageId: SAMPLE_ID, html, sanitizerVersion: 0 })
}

export async function listCollections(): Promise<Collection[]> {
  return (await (await getDb()).getAll('collections')).sort((a, b) => a.order - b.order)
}
export async function putCollection(c: Collection) {
  await (await getDb()).put('collections', c)
}
/** Removes the collection and un-files its pages; the pages themselves are kept. */
export async function deleteCollection(id: ID) {
  const db = await getDb()
  const tx = db.transaction(['collections', 'pages'], 'readwrite')
  await tx.objectStore('collections').delete(id)
  for (const p of await tx.objectStore('pages').getAll()) {
    if (p.collectionId === id) await tx.objectStore('pages').put({ ...p, collectionId: undefined })
  }
  await tx.done
}

/**
 * One-time: pages used to be laid out at a fixed 1280 px and shrunk to fit; they now follow the screen (Auto).
 * Ink keeps the width it was drawn at, so it can be moved with its content when the layout changes.
 */
export async function migrateToAutoLayout() {
  if (await getSetting<boolean>('autoLayoutV1')) return
  const db = await getDb()
  const tx = db.transaction(['pages', 'annotations', 'settings'], 'readwrite')
  for (const p of await tx.objectStore('pages').getAll()) {
    for (const a of await tx.objectStore('annotations').index('pageId').getAll(p.id)) {
      if (a.kind === 'ink' && a.layoutAt === undefined) await tx.objectStore('annotations').put({ ...a, layoutAt: p.layoutWidth })
    }
    if (p.layoutWidth === 1280) await tx.objectStore('pages').put({ ...p, layoutWidth: 0 })
  }
  const saved = await tx.objectStore('settings').get('defaultWidth')
  if (saved?.value === 1280) await tx.objectStore('settings').put({ key: 'defaultWidth', value: 0 })
  await tx.objectStore('settings').put({ key: 'autoLayoutV1', value: true })
  await tx.done
}
