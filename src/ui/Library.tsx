import { useEffect, useState } from 'preact/hooks'
import { importFile } from '../import/file-import.ts'
import { importUrl } from '../import/import-url.ts'
import { countAnnotations, deletePage, listPages, savePage } from '../store/repo.ts'
import type { Page } from '../store/schema.ts'
import { appKey, defaultWidth, go, WIDTHS, type Width } from './state.ts'

type Row = Page & { notes: number }

async function load(): Promise<Row[]> {
  const pages = await listPages()
  return Promise.all(pages.map(async (p) => ({ ...p, notes: await countAnnotations(p.id) })))
}

export function Library() {
  const [rows, setRows] = useState<Row[]>([])
  const [url, setUrl] = useState('')
  const [width, setWidth] = useState<Width>(defaultWidth.value)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [menu, setMenu] = useState('')
  const refresh = () => void load().then(setRows)
  useEffect(refresh, [])

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

  const groups = new Map<string, Row[]>()
  for (const r of rows) groups.set(r.siteOrigin, [...(groups.get(r.siteOrigin) ?? []), r])

  return (
    <div class="screen">
      <header class="bar">
        <h1>PageInk</h1>
        <button class="link" onClick={() => go('/settings')} aria-label="Settings">⚙︎</button>
      </header>

      <form class="card import" onSubmit={submit}>
        <input type="text" inputMode="url" placeholder="Paste a web address" value={url} onInput={(e) => setUrl((e.target as HTMLInputElement).value)} aria-label="Web address" autocapitalize="off" />
        <div class="row">
          <select value={width} onChange={(e) => setWidth(Number((e.target as HTMLSelectElement).value) as Width)} aria-label="Page layout">
            {WIDTHS.map(([w, label]) => <option key={w} value={w}>{label}</option>)}
          </select>
          <button type="submit" class="primary" disabled={!!busy}>Import</button>
          <label class="ghost file">
            Import file
            <input type="file" accept=".html,.htm,text/html" hidden onChange={(e) => {
              const f = (e.target as HTMLInputElement).files?.[0]
              if (f) void run(() => importFile(f, width))
            }} />
          </label>
        </div>
        {busy && <p class="hint" role="status">{busy}</p>}
        {error && <p class="error" role="alert">{error}</p>}
      </form>

      {[...groups].map(([origin, list]) => (
        <section key={origin}>
          <h2>{origin === 'file:' ? 'Files and samples' : origin.replace(/^https?:\/\//, '')}</h2>
          {list.map((p) => (
            <div class="item" key={p.id}>
              <button class="open" onClick={() => go(`/p/${p.id}`)}>
                <span class="mono">{(p.title[0] ?? '?').toUpperCase()}</span>
                <span class="meta">
                  <strong>{p.title}</strong>
                  <small>{new Date(p.updatedAt).toLocaleDateString()} · {p.notes} mark{p.notes === 1 ? '' : 's'} · {p.layoutWidth}px</small>
                </span>
              </button>
              <button class="link" aria-label={`Options for ${p.title}`} onClick={() => setMenu(menu === p.id ? '' : p.id)}>⋯</button>
              {menu === p.id && (
                <div class="menu">
                  <button onClick={() => {
                    const t = prompt('Rename page', p.title)?.trim()
                    setMenu('')
                    if (t) void savePage({ ...p, title: t, updatedAt: new Date().toISOString() }).then(refresh)
                  }}>Rename</button>
                  <button class="danger" onClick={() => {
                    setMenu('')
                    if (confirm(`Delete “${p.title}” and all its marks?`)) void deletePage(p.id).then(refresh)
                  }}>Delete</button>
                </div>
              )}
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}
