import { sanitize, SANITIZER_VERSION } from '../import/sanitize.ts'
import { getDb } from './db.ts'
import { setSetting } from './repo.ts'
import type { Annotation, Collection, Page, Snapshot } from './schema.ts'

export const BACKUP_FORMAT = 'pageink-backup'
const MAX_PAGES = 5000
const MAX_ANNOTATIONS = 500_000

/** Everything in the library as one file you can keep in iCloud Drive or Files. */
export interface Backup {
  format: typeof BACKUP_FORMAT
  version: 1
  exportedAt: string
  pages: Page[]
  snapshots: Snapshot[]
  annotations: Annotation[]
  collections: Collection[]
}

export async function buildBackup(): Promise<Backup> {
  const db = await getDb()
  const [pages, snapshots, annotations, collections] = await Promise.all([
    db.getAll('pages'), db.getAll('snapshots'), db.getAll('annotations'), db.getAll('collections'),
  ])
  return { format: BACKUP_FORMAT, version: 1, exportedAt: new Date().toISOString(), pages, snapshots, annotations, collections }
}

export const backupFileName = (d = new Date()) => `pageink-${d.toISOString().slice(0, 10)}.pageink.json`

/** Hands the backup to the share sheet (iPad: Save to Files, AirDrop...) or downloads it; remembers when. */
export async function saveBackup(): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const text = JSON.stringify(await buildBackup())
  const name = backupFileName()
  const file = new File([text], name, { type: 'application/json' })
  let how: 'shared' | 'downloaded' = 'downloaded'
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'PageInk backup' })
      how = 'shared'
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled'
      how = 'downloaded' // sharing failed for another reason: fall back to a plain download
    }
  }
  if (how === 'downloaded') {
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    document.body.append(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }
  await setSetting('lastBackup', new Date().toISOString())
  return how
}

const isStr = (v: unknown): v is string => typeof v === 'string'
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Reads and checks a backup file. Anything doubtful is rejected whole, so a bad file can never half-restore. */
export function parseBackup(text: string): Backup {
  const notBackup = () => new Error('This file is not a PageInk backup.')
  let d: unknown
  try { d = JSON.parse(text) } catch { throw notBackup() }
  if (!isObj(d) || d.format !== BACKUP_FORMAT) throw notBackup()
  if (d.version !== 1) throw new Error('This backup was made by a newer version of PageInk. Update the app and try again.')
  const list = (key: string) => {
    const v = d[key]
    if (!Array.isArray(v)) throw notBackup()
    return v as unknown[]
  }
  const pages = list('pages')
  const snapshots = list('snapshots')
  const annotations = list('annotations')
  const collections = list('collections')
  if (pages.length > MAX_PAGES || annotations.length > MAX_ANNOTATIONS) throw new Error('This backup is too large to restore.')
  for (const p of pages) if (!isObj(p) || !isStr(p.id) || !isStr(p.title) || !isStr(p.updatedAt) || typeof p.layoutWidth !== 'number' || !Array.isArray(p.tags)) throw notBackup()
  for (const s of snapshots) if (!isObj(s) || !isStr(s.pageId) || !isStr(s.html)) throw notBackup()
  for (const a of annotations) if (!isObj(a) || !isStr(a.id) || !isStr(a.pageId) || !isStr(a.kind) || !isStr(a.updatedAt) || !isObj(a.anchor)) throw notBackup()
  for (const c of collections) if (!isObj(c) || !isStr(c.id) || !isStr(c.name)) throw notBackup()
  return d as unknown as Backup
}

export interface RestoreSummary { pages: number; annotations: number; collections: number }

/**
 * Merges a backup into the library: records that are missing, or newer than what you have, are added; nothing is
 * deleted or overwritten with older data. Page copies are cleaned again on the way in, because a file is untrusted.
 * shortcut: pin/tag edits do not change a page's updatedAt, so they only restore onto a page that is missing.
 */
export async function restoreBackup(b: Backup): Promise<RestoreSummary> {
  const html = new Map(b.snapshots.map((s) => [s.pageId, s.html]))
  const clean = new Map<string, string>()
  for (const p of b.pages) {
    const h = html.get(p.id)
    if (h !== undefined) clean.set(p.id, sanitize(h, p.url || undefined)) // before the transaction: it must not wait on anything but the database
  }

  const db = await getDb()
  const tx = db.transaction(['pages', 'snapshots', 'annotations', 'collections'], 'readwrite')
  const summary: RestoreSummary = { pages: 0, annotations: 0, collections: 0 }
  for (const p of b.pages) {
    const have = await tx.objectStore('pages').get(p.id)
    const newer = !have || p.updatedAt > have.updatedAt
    if (newer) { await tx.objectStore('pages').put(p); summary.pages++ }
    const copy = clean.get(p.id)
    if (copy !== undefined && (newer || !(await tx.objectStore('snapshots').get(p.id)))) {
      await tx.objectStore('snapshots').put({ pageId: p.id, html: copy, sanitizerVersion: SANITIZER_VERSION })
    }
  }
  for (const a of b.annotations) {
    const have = await tx.objectStore('annotations').get(a.id)
    if (!have || a.updatedAt > have.updatedAt) { await tx.objectStore('annotations').put(a); summary.annotations++ }
  }
  for (const c of b.collections) {
    if (!(await tx.objectStore('collections').get(c.id))) { await tx.objectStore('collections').put(c); summary.collections++ }
  }
  await tx.done
  return summary
}
