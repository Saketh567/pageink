import { useEffect, useState } from 'preact/hooks'
import { importFile } from '../import/file-import.ts'
import { importUrl } from '../import/import-url.ts'
import { applyFilters, SORTS, sortRows, tagCounts, type Row, type Sort } from '../store/organize.ts'
import { countAnnotations, listCollections, listPages, patchPage } from '../store/repo.ts'
import type { Collection, Page } from '../store/schema.ts'
import { setPref } from './appearance.ts'
import { Icon, Logo } from './icons.tsx'
import { PageCard } from './PageCard.tsx'
import { CollectionSheet, PageSheet } from './Sheets.tsx'
import { appKey, defaultWidth, go, sort, view, WIDTHS, type Width } from './state.ts'

type SheetState = { k: 'page'; id: string } | { k: 'coll'; id?: string } | null
const BUILTIN: Record<string, string> = { all: 'All pages', pinned: 'Pinned', none: 'Unsorted' }

export function Library() {
  const [rows, setRows] = useState<Row[]>([])
  const [cols, setCols] = useState<Collection[]>([])
  const [loaded, setLoaded] = useState(false)
  const [query, setQuery] = useState('')
  const [coll, setColl] = useState('all')
  const [tag, setTag] = useState('')
  const [sheet, setSheet] = useState<SheetState>(null)
  const [url, setUrl] = useState('')
  const [width, setWidth] = useState<Width>(defaultWidth.value)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [dropOn, setDropOn] = useState('')

  const refresh = async () => {
    const [pages, c] = await Promise.all([listPages(), listCollections()])
    setRows(await Promise.all(pages.map(async (p) => ({ ...p, notes: await countAnnotations(p.id) }))))
    setCols(c)
    setLoaded(true)
  }
  useEffect(() => { void refresh() }, [])
  // a deleted collection (or tag nobody uses any more) should not leave an empty filter behind
  useEffect(() => {
    if (loaded && !BUILTIN[coll] && !cols.some((c) => c.id === coll)) setColl('all')
    if (loaded && tag && !rows.some((r) => r.tags.includes(tag))) setTag('')
  }, [loaded, cols, rows])

  async function run(job: () => Promise<Page>) {
    setError('')
    try {
      const page = await job()
      setUrl('')
      go(`/p/${page.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed.')
    } finally {
      setBusy('')
    }
  }
  const submit = (e: Event) => {
    e.preventDefault()
    if (!url.trim()) return
    if (!appKey.value) return setError('Add your personal key in Settings first.')
    void run(() => importUrl(url, width, appKey.value, setBusy))
  }

  const visible = sortRows(applyFilters(rows, { query, collection: coll, tag }), sort.value)
  const countIn = (f: (r: Row) => boolean) => rows.filter(f).length
  const colById = new Map(cols.map((c) => [c.id, c]))
  const title = BUILTIN[coll] ?? colById.get(coll)?.name ?? 'All pages'
  const groups: Array<[string, Row[]]> = [['', visible]]
  if (sort.value === 'site') {
    groups.length = 0
    for (const r of visible) {
      const g = groups.find(([o]) => o === r.siteOrigin)
      if (g) g[1].push(r)
      else groups.push([r.siteOrigin, [r]])
    }
  }
  const sheetRow = sheet?.k === 'page' ? rows.find((r) => r.id === sheet.id) : undefined
  const sheetColl = sheet?.k === 'coll' && sheet.id ? colById.get(sheet.id) : undefined

  /** Dropping a card on a sidebar entry files it: a collection, Pinned, or Unsorted. */
  const dropPatch = (id: string): Partial<Page> | undefined =>
    id === 'pinned' ? { pinned: true } : id === 'none' ? { collectionId: undefined } : id === 'all' ? undefined : { collectionId: id }
  const onDrop = (id: string, e: DragEvent) => {
    e.preventDefault()
    setDropOn('')
    const pageId = e.dataTransfer?.getData('application/x-pageink-page')
    const patch = dropPatch(id)
    if (pageId && patch) void patchPage(pageId, patch).then(refresh)
  }

  const navItem = (id: string, label: string, count: number, dot?: string, more?: () => void) => (
    <div class="navrow" key={id}>
      <button class={`nav ${dropOn === id ? 'drop' : ''}`} aria-current={coll === id} onClick={() => setColl(id)}
        onDragOver={(e) => { if (dropPatch(id)) { e.preventDefault(); setDropOn(id) } }} onDragLeave={() => setDropOn('')} onDrop={(e) => onDrop(id, e)}>
        {dot ? <i class="dotc" style={{ background: dot }} /> : null}
        <span>{label}</span>
        <span class="count">{count}</span>
      </button>
      {more && <button class="more" aria-label={`Edit collection ${label}`} onClick={more}><Icon name="more" /></button>}
    </div>
  )

  return (
    <div class="lib">
      <aside class="side" aria-label="Library navigation">
        <div class="brand"><Logo />PageInk</div>
        <nav class="navgroup">
          {navItem('all', BUILTIN.all, rows.length)}
          {navItem('pinned', BUILTIN.pinned, countIn((r) => !!r.pinned))}
          {navItem('none', BUILTIN.none, countIn((r) => !r.collectionId))}
        </nav>
        <div class="sidehead"><span>Collections</span><button aria-label="New collection" onClick={() => setSheet({ k: 'coll' })}><Icon name="plus" /></button></div>
        <nav class="navgroup">
          {cols.map((c) => navItem(c.id, c.name, countIn((r) => r.collectionId === c.id), c.color, () => setSheet({ k: 'coll', id: c.id })))}
          <button class="nav addcoll" aria-label="New collection" onClick={() => setSheet({ k: 'coll' })}><Icon name="plus" /><span>New collection</span></button>
        </nav>
        {tagCounts(rows).length > 0 && <div class="sidehead"><span>Tags</span></div>}
        <div class="tagcloud">
          {tagCounts(rows).map(([t, n]) => (
            <button key={t} class="chip" aria-pressed={tag === t} onClick={() => setTag(tag === t ? '' : t)}>#{t} <small>{n}</small></button>
          ))}
        </div>
      </aside>

      <main class="main">
        <div class="top">
          <div class="search">
            <Icon name="search" />
            <input class="field" type="search" placeholder="Search titles, sites and tags" aria-label="Search" value={query} onInput={(e) => setQuery((e.target as HTMLInputElement).value)} />
          </div>
          <select class="field" aria-label="Sort" value={sort.value} onChange={(e) => setPref('sort', sort, (e.target as HTMLSelectElement).value as Sort)}>
            {SORTS.map(([s, label]) => <option key={s} value={s}>{label}</option>)}
          </select>
          <div class="seg" role="group" aria-label="Layout">
            <button aria-pressed={view.value === 'grid'} aria-label="Card view" onClick={() => setPref('view', view, 'grid')}><Icon name="grid" /></button>
            <button aria-pressed={view.value === 'list'} aria-label="List view" onClick={() => setPref('view', view, 'list')}><Icon name="list" /></button>
          </div>
          <button class="btn icon" aria-label="Settings" onClick={() => go('/settings')}><Icon name="sliders" /></button>
        </div>

        <form class="importbar" onSubmit={submit}>
          <input class="field" type="text" inputMode="url" placeholder="Paste a web address to import" aria-label="Web address" autocapitalize="off" value={url} onInput={(e) => setUrl((e.target as HTMLInputElement).value)} />
          <select class="field" value={width} onChange={(e) => setWidth(Number((e.target as HTMLSelectElement).value) as Width)} aria-label="Page layout">
            {WIDTHS.map(([w, label]) => <option key={w} value={w}>{label}</option>)}
          </select>
          <button type="submit" class="btn primary" disabled={!!busy}>Import</button>
          <label class="btn ghost">
            <Icon name="file" />Import file
            <input type="file" accept=".html,.htm,text/html" hidden onChange={(e) => {
              const f = (e.target as HTMLInputElement).files?.[0]
              if (f) void run(() => importFile(f, width))
            }} />
          </label>
        </form>
        {busy && <p class="hint status" role="status">{busy}</p>}
        {error && <p class="error status" role="alert">{error}</p>}

        <div class="heading">
          <h1>{title}</h1>
          <span>{visible.length} {visible.length === 1 ? 'page' : 'pages'}</span>
          {tag && <button class="chip" aria-label={`Clear tag ${tag}`} onClick={() => setTag('')}>#{tag}<Icon name="x" /></button>}
        </div>

        {loaded && visible.length === 0 && (
          <div class="empty"><strong>{rows.length ? 'Nothing matches' : 'Your library is empty'}</strong>{rows.length ? 'Try a different search, tag or collection.' : 'Paste a web address above to import your first page.'}</div>
        )}

        {groups.map(([origin, list]) => (
          <section key={origin}>
            {origin && <div class="sidehead"><span>{origin === 'file:' ? 'Files and samples' : origin.replace(/^https?:\/\//, '')}</span></div>}
            <div class={view.value === 'grid' ? 'grid' : 'list'}>
              {list.map((r) => (
                <PageCard key={r.id} row={r} collection={r.collectionId ? colById.get(r.collectionId) : undefined}
                  onOpen={() => go(`/p/${r.id}`)} onMore={() => setSheet({ k: 'page', id: r.id })}
                  onPin={() => void patchPage(r.id, { pinned: !r.pinned }).then(refresh)} />
              ))}
            </div>
          </section>
        ))}
      </main>

      {sheetRow && <PageSheet row={sheetRow} collections={cols} onChanged={() => void refresh()} onClose={() => setSheet(null)} />}
      {sheet?.k === 'coll' && <CollectionSheet collection={sheetColl} nextOrder={cols.length ? Math.max(...cols.map((c) => c.order)) + 1 : 0} onChanged={() => void refresh()} onClose={() => setSheet(null)} />}
    </div>
  )
}
