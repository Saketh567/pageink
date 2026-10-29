import { appKey, defaultWidth, drawWithFinger, go, WIDTHS, type Width } from './state.ts'
import { getSetting, setSetting } from '../store/repo.ts'

export async function loadSettings() {
  appKey.value = (await getSetting<string>('appKey')) ?? ''
  defaultWidth.value = (await getSetting<Width>('defaultWidth')) ?? 1280
  drawWithFinger.value = (await getSetting<boolean>('drawWithFinger')) ?? false
}

export function Settings() {
  return (
    <div class="screen">
      <header class="bar">
        <button class="link" onClick={() => go('')}>‹ Library</button>
        <h1>Settings</h1>
      </header>
      <section class="card">
        <label for="key">Personal key</label>
        <p class="hint">The key you set as APP_KEY on the server. It stays on this device and unlocks importing from a URL.</p>
        <input
          id="key" type="password" autocomplete="off" autocapitalize="off" value={appKey.value}
          onChange={(e) => { appKey.value = (e.target as HTMLInputElement).value.trim(); void setSetting('appKey', appKey.value) }}
        />
        <button class="ghost" onClick={() => { appKey.value = ''; void setSetting('appKey', '') }}>Forget key</button>
      </section>
      <section class="card">
        <label for="width">Default page layout</label>
        <select id="width" value={defaultWidth.value} onChange={(e) => { defaultWidth.value = Number((e.target as HTMLSelectElement).value) as Width; void setSetting('defaultWidth', defaultWidth.value) }}>
          {WIDTHS.map(([w, label]) => <option key={w} value={w}>{label}</option>)}
        </select>
      </section>
      <section class="card row">
        <div><label for="finger">Draw with finger</label><p class="hint">Fingers draw instead of scrolling while in Markup mode.</p></div>
        <input
          id="finger" type="checkbox" checked={drawWithFinger.value}
          onChange={(e) => { drawWithFinger.value = (e.target as HTMLInputElement).checked; void setSetting('drawWithFinger', drawWithFinger.value) }}
        />
      </section>
    </div>
  )
}
