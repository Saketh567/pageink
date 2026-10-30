import { effect } from '@preact/signals'
import { getSetting, setSetting } from '../store/repo.ts'
import { accent, density, sort, theme, view, type Density, type Theme } from './state.ts'
import type { Sort } from '../store/organize.ts'

/** Readable text colour for a given background: dark ink on light accents, white on dark ones. */
export function inkFor(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return '#fff'
  const n = parseInt(m[1], 16)
  const lum = (((n >> 16) & 255) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000
  return lum > 150 ? '#111' : '#fff'
}

const dark = matchMedia('(prefers-color-scheme: dark)')

/** Writes the chosen theme, accent and density onto <html>; re-runs when any of them (or the OS theme) changes. */
export function startAppearance() {
  const root = document.documentElement
  const apply = () => {
    const t = theme.value === 'auto' ? (dark.matches ? 'dark' : 'light') : theme.value
    root.dataset.theme = t
    root.dataset.density = density.value
    root.style.setProperty('--accent', accent.value)
    root.style.setProperty('--accent-ink', inkFor(accent.value))
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', getComputedStyle(root).getPropertyValue('--bg').trim() || '#0b0b0f')
  }
  dark.addEventListener('change', apply)
  return effect(apply)
}

export async function loadAppearance() {
  theme.value = (await getSetting<Theme>('theme')) ?? 'auto'
  accent.value = (await getSetting<string>('accent')) ?? accent.value
  density.value = (await getSetting<Density>('density')) ?? 'comfortable'
  view.value = (await getSetting<'grid' | 'list'>('view')) ?? 'grid'
  sort.value = (await getSetting<Sort>('sort')) ?? 'recent'
}

/** Update a preference signal and remember it. */
export function setPref<T>(key: string, s: { value: T }, value: T) {
  s.value = value
  void setSetting(key, value)
}
