import { useEffect, useState } from 'preact/hooks'
import { parseBackup, restoreBackup, saveBackup } from '../store/backup.ts'
import { getSetting } from '../store/repo.ts'
import { setPref } from './appearance.ts'
import { accent, ACCENTS, appKey, defaultWidth, density, drawWithFinger, go, sort, theme, view, WIDTHS, type Density, type Theme, type Width } from './state.ts'
import { SORTS, type Sort } from '../store/organize.ts'

export async function loadSettings() {
  appKey.value = (await getSetting<string>('appKey')) ?? ''
  defaultWidth.value = (await getSetting<Width>('defaultWidth')) ?? 1280
  drawWithFinger.value = (await getSetting<boolean>('drawWithFinger')) ?? false
}

const THEMES: Array<[Theme, string]> = [['auto', 'Auto'], ['dark', 'Dark'], ['light', 'Light'], ['paper', 'Paper']]

const mb = (n: number) => (n / 1048576).toFixed(n < 10485760 ? 1 : 0) + ' MB'
const ago = (iso: string) => {
  const d = Math.floor((Date.now() - Date.parse(iso)) / 864e5)
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`
}
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** Where your library lives, how much space it uses, and the backup and restore buttons. */
function DataCard() {
  const [info, setInfo] = useState({ used: 0, quota: 0, persisted: false, last: '' })
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const refresh = async () => {
    const e = await navigator.storage?.estimate?.()
    setInfo({ used: e?.usage ?? 0, quota: e?.quota ?? 0, persisted: !!(await navigator.storage?.persisted?.()), last: (await getSetting<string>('lastBackup')) ?? '' })
  }
  useEffect(() => { void refresh() }, [])

  async function backup() {
    try {
      const how = await saveBackup()
      if (how !== 'cancelled') setMsg({ ok: true, text: how === 'shared' ? 'Backup saved.' : 'Backup downloaded to your Downloads folder.' })
      await refresh()
    } catch {
      setMsg({ ok: false, text: 'Backup failed. Please try again.' })
    }
  }
  async function restore(file: File) {
    try {
      const r = await restoreBackup(parseBackup(await file.text()))
      setMsg({ ok: true, text: `Restored ${plural(r.pages, 'page')}, ${plural(r.annotations, 'mark')} and ${plural(r.collections, 'collection')}. Nothing you already had was replaced with older data.` })
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Restore failed.' })
    }
  }

  return (
    <section class="card">
      <h2>Your data</h2>
      <p class="hint">Everything you import and mark lives on this device, not on a server. Keep a backup file in iCloud Drive or Files so it can never be lost, and to move your library to another device.</p>
      <div class="line"><span>Last backup</span><strong>{info.last ? ago(info.last) : 'never'}</strong></div>
      <div class="line"><span>Space used</span><span>{mb(info.used)}{info.quota ? ` of ${mb(info.quota)}` : ''}</span></div>
      <div class="line"><span>Protected from automatic clean-up</span><span>{info.persisted ? 'Yes' : 'Not yet (add PageInk to your Home Screen)'}</span></div>
      <div class="row">
        <button class="btn primary" onClick={() => void backup()}>Back up everything</button>
        <label class="btn ghost">
          Restore from backup
          <input type="file" accept=".json,application/json" hidden aria-label="Backup file" onChange={(e) => {
            const input = e.target as HTMLInputElement
            const f = input.files?.[0]
            input.value = ''
            if (f) void restore(f)
          }} />
        </label>
      </div>
      {msg && <p class={msg.ok ? 'hint' : 'error'} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
    </section>
  )
}

export function Settings() {
  return (
    <div class="screen">
      <header class="bar">
        <button class="btn" onClick={() => go('')}>‹ Library</button>
        <h1>Settings</h1>
      </header>

      <section class="card">
        <h2>Appearance</h2>
        <div class="themes" role="group" aria-label="Theme">
          {THEMES.map(([t, label]) => (
            <button key={t} class={`theme ${t === 'auto' ? 'auto' : ''}`} aria-pressed={theme.value === t} onClick={() => setPref('theme', theme, t)}>
              <div class="pv" data-theme={t === 'auto' ? undefined : t}><i /><i /><b /></div>
              {label}
            </button>
          ))}
        </div>
        <div>
          <label class="lbl">Accent colour</label>
          <div class="swatches" role="group" aria-label="Accent colour">
            {ACCENTS.map((c) => (
              <button key={c} class="sw" style={{ background: c }} aria-label={`Accent ${c}`} aria-pressed={accent.value === c} onClick={() => setPref('accent', accent, c)} />
            ))}
            <label class="sw" style={{ background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)', overflow: 'hidden', position: 'relative' }} aria-label="Custom accent colour">
              <input type="color" value={accent.value} style={{ opacity: 0, position: 'absolute', inset: 0, width: '100%', height: '100%' }} onInput={(e) => setPref('accent', accent, (e.target as HTMLInputElement).value)} />
            </label>
          </div>
        </div>
        <div class="line">
          <label class="lbl">Density</label>
          <div class="seg" role="group" aria-label="Density">
            {(['comfortable', 'compact'] as Density[]).map((d) => (
              <button key={d} aria-pressed={density.value === d} onClick={() => setPref('density', density, d)}>{d === 'comfortable' ? 'Comfortable' : 'Compact'}</button>
            ))}
          </div>
        </div>
      </section>

      <section class="card">
        <h2>Library</h2>
        <div class="line">
          <label class="lbl" for="view">Layout</label>
          <div class="seg" role="group" aria-label="Library layout">
            {(['grid', 'list'] as const).map((v) => (
              <button key={v} aria-pressed={view.value === v} onClick={() => setPref('view', view, v)}>{v === 'grid' ? 'Cards' : 'List'}</button>
            ))}
          </div>
        </div>
        <div class="line">
          <label class="lbl" for="sortpref">Default order</label>
          <select id="sortpref" class="field" style={{ width: 'auto' }} value={sort.value} onChange={(e) => setPref('sort', sort, (e.target as HTMLSelectElement).value as Sort)}>
            {SORTS.map(([s, label]) => <option key={s} value={s}>{label}</option>)}
          </select>
        </div>
        <div class="line">
          <label class="lbl" for="width">Page layout for imports</label>
          <select id="width" class="field" style={{ width: 'auto' }} value={defaultWidth.value} onChange={(e) => setPref('defaultWidth', defaultWidth, Number((e.target as HTMLSelectElement).value) as Width)}>
            {WIDTHS.map(([w, label]) => <option key={w} value={w}>{label}</option>)}
          </select>
        </div>
      </section>

      <section class="card">
        <h2>Importing</h2>
        <label class="lbl" for="key">Access key (optional)</label>
        <p class="hint">Importing works without one. Only add a key if whoever runs your server asked you to.</p>
        <input id="key" class="field" type="password" autocomplete="off" autocapitalize="off" value={appKey.value}
          onChange={(e) => setPref('appKey', appKey, (e.target as HTMLInputElement).value.trim())} />
        <div><button class="btn ghost" onClick={() => setPref('appKey', appKey, '')}>Remove key</button></div>
      </section>

      <DataCard />

      <section class="card">
        <h2>Drawing</h2>
        <div class="line">
          <div><label class="lbl" for="finger">Draw with finger</label><p class="hint">Fingers draw instead of scrolling while in Mark mode.</p></div>
          <input id="finger" type="checkbox" checked={drawWithFinger.value} onChange={(e) => setPref('drawWithFinger', drawWithFinger, (e.target as HTMLInputElement).checked)} />
        </div>
      </section>
      <p class="hint" style={{ textAlign: 'center', marginTop: '18px' }}>PageInk build {__BUILD__}</p>
    </div>
  )
}
