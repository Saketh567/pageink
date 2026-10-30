// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { openDB } from 'idb'
import { beforeAll, describe, expect, test } from 'vitest'
import { getDb } from '../src/store/db.ts'
import { dataVersion, runBackgroundMigrations, runMigrations } from '../src/store/migrate.ts'
import { deletePage, extractText, getSetting, listAnnotations, putPageText } from '../src/store/repo.ts'

const T = '2026-01-01T00:00:00.000Z'

/** A library exactly as version 1 left it: database version 2, fixed 1280 layouts, ink with no recorded width, no texts store. */
beforeAll(async () => {
  const old = await openDB('pageink', 2, {
    upgrade(db) {
      const pages = db.createObjectStore('pages', { keyPath: 'id' })
      pages.createIndex('siteOrigin', 'siteOrigin')
      pages.createIndex('updatedAt', 'updatedAt')
      db.createObjectStore('snapshots', { keyPath: 'pageId' })
      db.createObjectStore('annotations', { keyPath: 'id' }).createIndex('pageId', 'pageId')
      db.createObjectStore('blobs', { keyPath: 'id' })
      db.createObjectStore('settings', { keyPath: 'key' })
      db.createObjectStore('collections', { keyPath: 'id' })
    },
  })
  const page = (id: string, layoutWidth: number) => ({ id, schemaVersion: 1, url: `https://site.example/${id}`, siteOrigin: 'https://site.example', title: `Title ${id}`, captureMethod: 'fetch', capturedAt: T, layoutWidth, docHeight: 100, textHash: '', tags: ['a'], createdAt: T, updatedAt: T })
  await old.put('pages', page('a', 1280))
  await old.put('pages', page('b', 820))
  await old.put('snapshots', { pageId: 'a', html: '<style>p{color:red}</style><h1>Alpha   heading</h1><script>1</script><p>First\n paragraph.</p>', sanitizerVersion: 2 })
  await old.put('snapshots', { pageId: 'b', html: '<p>Bravo text</p>', sanitizerVersion: 2 })
  await old.put('annotations', { id: 'i1', pageId: 'a', kind: 'ink', layer: 'ink', color: '#000', anchor: { page: { x: 1, y: 2 } }, createdAt: T, updatedAt: T })
  await old.put('annotations', { id: 'h1', pageId: 'a', kind: 'highlight', layer: 'highlights', color: '#ff0', anchor: { page: { x: 1, y: 2 } }, createdAt: T, updatedAt: T })
  await old.put('settings', { key: 'defaultWidth', value: 1280 })
  old.close()
})

describe('upgrading a version 1 library', () => {
  test('quick upgrades run first and leave every record in place', async () => {
    await runMigrations()
    const db = await getDb()
    expect(db.version).toBe(4)
    expect(await db.count('pages')).toBe(2)
    expect((await db.get('pages', 'a'))?.layoutWidth).toBe(0) // fixed 1280 became Auto
    expect((await db.get('pages', 'b'))?.layoutWidth).toBe(820) // other widths stay
    expect((await listAnnotations('a')).find((x) => x.id === 'i1')?.layoutAt).toBe(1280)
    expect(await getSetting('defaultWidth')).toBe(0)
    expect(await dataVersion()).toBe(2) // 3 (page text) is still to come, so the unbroken run stops at 2
    expect(await db.count('texts')).toBe(0) // the slow step has not run yet
    expect((await db.get('boards', 'home'))?.name).toBe('Home') // the quick step that builds the desk has run
    const cards = await db.getAllFromIndex('cards', 'boardId', 'home')
    expect(cards.filter((c) => c.kind === 'page').map((c) => c.pageId).sort()).toEqual(['a', 'b']) // every page has a poster
    expect(cards.filter((c) => c.kind === 'frame')).toHaveLength(1) // in a frame for loose pages
  })

  test('the slow step then fills in the text of every page', async () => {
    await runBackgroundMigrations()
    const db = await getDb()
    expect(await dataVersion()).toBe(4)
    expect(await db.get('texts', 'a')).toEqual({ pageId: 'a', title: 'Title a', text: 'Alpha heading First paragraph.' })
    expect((await db.get('texts', 'b'))?.text).toBe('Bravo text')
  })

  test('running everything again changes nothing', async () => {
    const db = await getDb()
    const before = JSON.stringify([await db.getAll('pages'), await db.getAll('texts'), await db.getAll('annotations')])
    await runMigrations()
    await runBackgroundMigrations()
    expect(JSON.stringify([await db.getAll('pages'), await db.getAll('texts'), await db.getAll('annotations')])).toBe(before)
    expect(await dataVersion()).toBe(4)
  })

  test('the index on saved assets exists and is empty for old pages', async () => {
    const db = await getDb()
    expect(Array.from(db.transaction('snapshots').store.indexNames)).toContain('assets')
    expect(await db.getAllFromIndex('snapshots', 'assets', 'a'.repeat(64))).toEqual([])
  })
})

describe('the desk', () => {
  test('a card you moved is never moved back by running the steps again, and a deleted page loses its card', async () => {
    const db = await getDb()
    const card = (await db.getAllFromIndex('cards', 'boardId', 'home')).find((c) => c.pageId === 'a')!
    await db.put('cards', { ...card, x: 9999, y: 8888 })
    await db.delete('settings', 'migrated:4')
    await db.put('settings', { key: 'dataVersion', value: 3 })
    await db.delete('settings', 'migrated:4')
    await runMigrations()
    const again = (await db.getAllFromIndex('cards', 'boardId', 'home')).find((c) => c.pageId === 'a')!
    expect([again.x, again.y]).toEqual([9999, 8888])
    await deletePage('a')
    expect((await db.getAllFromIndex('cards', 'boardId', 'home')).some((c) => c.pageId === 'a')).toBe(false)
  })
})

describe('page text', () => {
  test('styles and scripts are left out, spaces collapse, and very long pages are capped', () => {
    expect(extractText('<style>x{}</style><p>A   b</p><script>no()</script><p>c</p>')).toBe('A b c')
    expect(extractText(`<p>${'word '.repeat(100_000)}</p>`)).toHaveLength(200_000)
  })

  test('deleting a page removes its text too', async () => {
    await putPageText('b', 'Title b', '<p>Bravo text</p>')
    await deletePage('b')
    expect(await (await getDb()).get('texts', 'b')).toBeUndefined()
  })
})
