import { signal } from '@preact/signals'

export type Tool = 'pen' | 'highlighter' | 'eraser'
export type Edge = 'top' | 'bottom' | 'left' | 'right'

export const PALETTE = ['#1d1d1f', '#ff3b30', '#ff9500', '#ffd60a', '#34c759', '#0a84ff', '#5e5ce6', '#ff2d55']

export const mode = signal<'read' | 'markup'>('markup')
export const tool = signal<Tool>('pen')
export const color = signal(PALETTE[1])
export const size = signal<2 | 4 | 8>(4)
export const drawWithFinger = signal(false)
export const canUndo = signal(false)
export const canRedo = signal(false)

function savedEdge(): Edge {
  try {
    const v = localStorage.getItem('pageink.tray')
    if (v === 'top' || v === 'bottom' || v === 'left' || v === 'right') return v
  } catch { /* storage can be blocked; default is fine */ }
  return 'bottom'
}
export const trayEdge = signal<Edge>(savedEdge())

export type Width = 1280 | 820 | 390
export const WIDTHS: Array<[Width, string]> = [[1280, 'Desktop 1280'], [820, 'Tablet 820'], [390, 'Phone 390']]

export const appKey = signal('')
export const defaultWidth = signal<Width>(1280)
/** '' is the library; '/p/<id>' is a page; '/settings' is settings. */
export const route = signal(location.hash.replace(/^#/, ''))
addEventListener('hashchange', () => (route.value = location.hash.replace(/^#/, '')))
export const go = (path: string) => { location.hash = path }

/** Filled in by the editor once a page is open. */
export const actions = { undo() {}, redo() {} }
