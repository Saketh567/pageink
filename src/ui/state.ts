import { signal } from '@preact/signals'
import type { Mark, Meaning } from '../export/study-sheet.ts'
import type { Sort } from '../store/organize.ts'
import type { Page } from '../store/schema.ts'
import type { Viewer } from '../viewer/viewer.ts'

export type Tool = 'pen' | 'highlighter' | 'eraser' | 'mark' | 'note'
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

export type Width = 0 | 1280 | 820 | 390
export const WIDTHS: Array<[Width, string]> = [[0, 'Auto (fits this screen)'], [1280, 'Desktop 1280'], [820, 'Tablet 820'], [390, 'Phone 390']]

export const appKey = signal('')
export const defaultWidth = signal<Width>(0)
/** '' is the library; '/p/<id>' is a page; '/settings' is settings. */
export const route = signal(location.hash.replace(/^#/, ''))
addEventListener('hashchange', () => (route.value = location.hash.replace(/^#/, '')))
export const go = (path: string) => { location.hash = path }

export type Theme = 'auto' | 'dark' | 'light' | 'paper'
export type Density = 'comfortable' | 'compact'
export const ACCENTS = ['#0a84ff', '#5e5ce6', '#bf5af2', '#ff2d55', '#ff9500', '#ffcc00', '#34c759', '#30b0c7']
export const theme = signal<Theme>('paper')
export const accent = signal(ACCENTS[0])
export const density = signal<Density>('comfortable')
export const view = signal<'grid' | 'list'>('grid')
export const sort = signal<Sort>('recent')

// ----- the open page: marks, notes, spotlight (filled in by the editor while a page is open)
export const meaning = signal<Meaning>('important')
export const marks = signal<Mark[]>([])
export const openNote = signal<string | null>(null)
export const spotlightId = signal<string | null>(null)
export const panelOpen = signal(false)
export const margin = signal(false)
export const activeViewer = signal<Viewer | null>(null)
export const currentPage = signal<Page | null>(null)
/** Pages you followed a link from, newest last, so a Back chip can return to them. */
export const trail = signal<string[]>([])
/** A short message shown briefly over the page. */
export const notice = signal('')
/** Bumped on scroll, zoom and layout so overlays (note cards, the heat strip) re-position themselves. */
export const viewTick = signal(0)
export const marksApi = {
  updateNote(_id: string, _text: string) {},
  setMeaning(_id: string, _m: Meaning) {},
  remove(_id: string) {},
  reveal(_id: string) {},
  spotlight(_id: string | null) {},
}

/** Filled in by the editor once a page is open. */
export const actions = { undo() {}, redo() {}, recapture() {} }

/** A newer version of the app has been installed in the background and is waiting for a reload. */
export const updateReady = signal(false)
