/**
 * The IndexedDB database (pages, snapshots, annotations, blobs, settings, collections) and its versioned upgrades.
 * Upgrades must never delete user data.
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Annotation, Collection, Page, PageText, Snapshot } from './schema.ts'

interface PageInkDB extends DBSchema {
  pages: { key: string; value: Page; indexes: { siteOrigin: string; updatedAt: string } }
  snapshots: { key: string; value: Snapshot; indexes: { assets: string } }
  annotations: { key: string; value: Annotation; indexes: { pageId: string } }
  /** Saved pictures, styles and fonts, once each, keyed by the SHA-256 of their bytes. Stored as raw bytes (not a Blob): Safari is unreliable with Blobs in IndexedDB. */
  blobs: { key: string; value: { id: string; type: string; data: ArrayBuffer } }
  settings: { key: string; value: { key: string; value: unknown } }
  collections: { key: string; value: Collection }
  texts: { key: string; value: PageText }
}

export type Db = IDBPDatabase<PageInkDB>

let dbPromise: Promise<Db> | undefined

/** Schema migrations go in the version switch below; never delete user data in a migration. */
export function getDb(name = 'pageink'): Promise<Db> {
  dbPromise ??= openDB<PageInkDB>(name, 3, {
    upgrade(db, oldVersion, _newVersion, tx) {
      if (oldVersion < 1) {
        const pages = db.createObjectStore('pages', { keyPath: 'id' })
        pages.createIndex('siteOrigin', 'siteOrigin')
        pages.createIndex('updatedAt', 'updatedAt')
        db.createObjectStore('snapshots', { keyPath: 'pageId' })
        db.createObjectStore('annotations', { keyPath: 'id' }).createIndex('pageId', 'pageId')
        db.createObjectStore('blobs', { keyPath: 'id' })
        db.createObjectStore('settings', { keyPath: 'key' })
      }
      if (oldVersion < 2) db.createObjectStore('collections', { keyPath: 'id' })
      if (oldVersion < 3) {
        // purely additive: which saved assets a page uses (looked up the other way round when cleaning up), and the text of each page
        tx.objectStore('snapshots').createIndex('assets', 'assets', { multiEntry: true })
        db.createObjectStore('texts', { keyPath: 'pageId' })
      }
    },
  })
  return dbPromise
}
