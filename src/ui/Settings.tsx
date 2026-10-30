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
        <label class="lbl" for="key">Personal key</label>
        <p class="hint">The key you set as APP_KEY on the server. It stays on this device and unlocks importing from a URL.</p>
        <input id="key" class="field" type="password" autocomplete="off" autocapitalize="off" value={appKey.value}
          onChange={(e) => setPref('appKey', appKey, (e.target as HTMLInputElement).value.trim())} />
        <div><button class="btn ghost" onClick={() => setPref('appKey', appKey, '')}>Forget key</button></div>
      </section>

      <section class="card">
        <h2>Drawing</h2>
        <div class="line">
          <div><label class="lbl" for="finger">Draw with finger</label><p class="hint">Fingers draw instead of scrolling while in Mark mode.</p></div>
          <input id="finger" type="checkbox" checked={drawWithFinger.value} onChange={(e) => setPref('drawWithFinger', drawWithFinger, (e.target as HTMLInputElement).checked)} />
        </div>
      </section>
    </div>
  )
}
