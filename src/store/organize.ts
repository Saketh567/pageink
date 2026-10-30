import type { Page } from './schema.ts'

export type Row = Page & { notes: number }
export type Sort = 'recent' | 'name' | 'marks' | 'site' | 'oldest'
/** 'all', 'pinned' and 'none' (not in any collection) are built in; anything else is a collection id. */
export interface Filters { query: string; collection: string; tag: string }

export const SORTS: Array<[Sort, string]> = [['recent', 'Recently opened'], ['name', 'Name'], ['marks', 'Most marks'], ['site', 'Site'], ['oldest', 'Oldest first']]

const lastTouched = (p: Page) => p.openedAt ?? p.updatedAt

export function applyFilters(rows: Row[], f: Filters): Row[] {
  const words = f.query.toLowerCase().split(/\s+/).filter(Boolean)
  return rows.filter((r) => {
    if (f.collection === 'pinned' && !r.pinned) return false
    if (f.collection === 'none' && r.collectionId) return false
    if (f.collection !== 'all' && f.collection !== 'pinned' && f.collection !== 'none' && r.collectionId !== f.collection) return false
    if (f.tag && !r.tags.includes(f.tag)) return false
    if (!words.length) return true
    const hay = `${r.title} ${r.url} ${r.siteOrigin} ${r.tags.join(' ')} ${r.description ?? ''}`.toLowerCase()
    return words.every((w) => hay.includes(w))
  })
}

/** Pinned pages always come first, then the chosen order. */
export function sortRows(rows: Row[], sort: Sort): Row[] {
  const by: Record<Sort, (a: Row, b: Row) => number> = {
    recent: (a, b) => lastTouched(b).localeCompare(lastTouched(a)),
    oldest: (a, b) => a.createdAt.localeCompare(b.createdAt),
    name: (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }),
    marks: (a, b) => b.notes - a.notes || lastTouched(b).localeCompare(lastTouched(a)),
    site: (a, b) => a.siteOrigin.localeCompare(b.siteOrigin) || lastTouched(b).localeCompare(lastTouched(a)),
  }
  return [...rows].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || by[sort](a, b))
}

export function tagCounts(rows: Row[]): Array<[string, number]> {
  const m = new Map<string, number>()
  for (const r of rows) for (const t of r.tags) m.set(t, (m.get(t) ?? 0) + 1)
  return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}

/** "Design, #UX  research" -> ['design', 'ux', 'research']. Commas or spaces separate tags; max 12, each up to 24 chars. */
export function normalizeTags(input: string): string[] {
  const out: string[] = []
  for (const raw of input.split(/[,\n\s]+/)) {
    const t = raw.replace(/^#+/, '').trim().toLowerCase().slice(0, 24)
    if (t && !out.includes(t)) out.push(t)
  }
  return out.slice(0, 12)
}
