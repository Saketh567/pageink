import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Annotation, Collection, Page, Snapshot } from './schema.ts'

interface PageInkDB extends DBSchema {
  pages: { key: string; value: Page; indexes: { siteOrigin: string; updatedAt: string } }
  snapshots: { key: string; value: Snapshot }
  annotations: { key: string; value: Annotation; indexes: { pageId: string } }
  blobs: { key: string; value: { id: string; type: string; data: Blob } }
  settings: { key: string; value: { key: string; value: unknown } }
  collections: { key: string; value: Collection }
}

export type Db = IDBPDatabase<PageInkDB>

let dbPromise: Promise<Db> | undefined

/** Schema migrations go in the version switch below; never delete user data in a migration. */
export function getDb(name = 'pageink'): Promise<Db> {
  dbPromise ??= openDB<PageInkDB>(name, 2, {
    upgrade(db, oldVersion) {
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
    },
  })
  return dbPromise
}
