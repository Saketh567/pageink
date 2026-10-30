/**
 * Connects drawing, marking and notes to the page: turns pen and pointer input into saved annotations, undo/redo,
 * the spotlight, and the lists the panels show.
 */
import { effect } from '@preact/signals'
import { elementAnchor, resolve as resolveCss, selectorFor } from '../anchor/css-selector.ts'
import { describe as describeText, textIndex } from '../anchor/text-quote.ts'
import { MEANINGS, type Meaning } from '../export/study-sheet.ts'
import { putAnnotation } from '../store/repo.ts'
import type { Annotation } from '../store/schema.ts'
import { actions, canRedo, canUndo, color, drawWithFinger, marks, marksApi, meaning, mode, openNote, size, spotlightId, tool, viewTick } from '../ui/state.ts'
import type { Viewer } from '../viewer/viewer.ts'
import { bindZoom } from '../viewer/zoom.ts'
import { createHistory } from './history.ts'
import { createInkLayer } from './ink-layer.ts'
import { createLiveCanvas } from './live-canvas.ts'
import { caretOffset, startMark, wordBounds, type MarkSession } from './mark.ts'
import { attachPointer, attachTapGestures } from './pointer.ts'
import { buildStroke, type InkPoint } from './stroke.ts'

const ERASER_SCREEN_PX = 10
const HIGHLIGHTER_FACTOR = 4
const DWELL_MS = 450
const TAP_PX = 6
const colorOf = (m: Meaning) => MEANINGS.find((x) => x[0] === m)![2]
const BLOCK = 'p,li,blockquote,h1,h2,h3,h4,h5,h6,td,th,dd,dt,figcaption,pre'

/**
 * The paragraph, list item or heading beside a margin scribble: look across the page at the scribble's height and take
 * the first real text block. Blank space or layout wrappers are skipped, so the leader never points at a whole-page container.
 */
function leaderTarget(doc: Document, y: number, pageWidth: number): string | null {
  for (let i = 1; i <= 9; i++) {
    const el = doc.elementFromPoint((pageWidth * i) / 10, y)?.closest(BLOCK)
    if (el) return selectorFor(el)
  }
  return null
}

/** Wires pointer input to the live canvas, the SVG layer, undo history, autosave and the marks list. */
export function createEditor(viewer: Viewer, pageId: string, initial: Annotation[]) {
  const doc = viewer.iframe.contentDocument
  const dirty = new Set<string>()
  let timer: ReturnType<typeof setTimeout> | undefined
  const refreshMarks = () => { marks.value = layer.marks() }
  const layer = createInkLayer(viewer.svg, (ids) => {
    ids.forEach((id) => dirty.add(id))
    clearTimeout(timer)
    timer = setTimeout(flush, 300)
    refreshMarks()
  }, () => viewer.layoutWidth)
  function flush() {
    clearTimeout(timer)
    const ids = [...dirty]
    dirty.clear()
    for (const id of ids) {
      const a = layer.get(id)
      if (a) void putAnnotation(a)
    }
  }
  const onHide = () => document.visibilityState === 'hidden' && flush()
  document.addEventListener('visibilitychange', onHide)
  addEventListener('pagehide', flush)

  layer.load(initial)
  if (doc) {
    layer.setDoc(doc)
    // web fonts and images arriving move text, so highlights are found again from their words
    void doc.fonts?.ready.then(() => { layer.reresolve(); refreshMarks() })
  }
  viewer.onLayout(() => { layer.reresolve(); refreshMarks() })
  refreshMarks()

  let tickPending = false
  viewer.onViewChange(() => {
    if (tickPending) return
    tickPending = true
    requestAnimationFrame(() => { tickPending = false; viewTick.value++ })
  })

  const history = createHistory(() => {
    canUndo.value = history.canUndo()
    canRedo.value = history.canRedo()
  })
  actions.undo = () => history.undo()
  actions.redo = () => history.redo()
  const live = createLiveCanvas(viewer)

  let points: InkPoint[] = []
  let erased: string[] = []
  let session: MarkSession | null = null
  let dwell: ReturnType<typeof setTimeout> | undefined
  let last: InkPoint | null = null

  const eraseAt = (p: InkPoint) => {
    for (const id of layer.hit(p.x, p.y, ERASER_SCREEN_PX / viewer.scale)) {
      layer.remove(id)
      erased.push(id)
    }
  }
  const effectiveSize = () => (tool.value === 'highlighter' ? size.value * HIGHLIGHTER_FACTOR : size.value)
  const showLive = (predicted: InkPoint[] = []) =>
    live.show({ points, predicted, tool: tool.value === 'highlighter' ? 'highlighter' : 'pen', size: effectiveSize(), color: color.value })

  /** Holding still grows the selection: words, then the sentence, then the paragraph. */
  const armDwell = () => {
    clearTimeout(dwell)
    dwell = setTimeout(() => {
      if (!session?.expand()) return
      const r = session.rects()
      layer.preview(r, colorOf(meaning.value))
      layer.pulse(r)
      armDwell()
    }, DWELL_MS)
  }

  function commitMark() {
    clearTimeout(dwell)
    const s = session
    session = null
    layer.preview(null)
    if (!s || !doc) return
    const res = s.result()
    const rects = s.rects()
    if (res.end <= res.start || !rects.length) return
    const now = new Date().toISOString()
    const m = meaning.value
    const a: Annotation = {
      id: crypto.randomUUID(), pageId, kind: 'highlight', layer: 'highlights', color: colorOf(m), meaning: m,
      anchor: { page: { x: rects[0].x, y: rects[0].y }, text: describeText(textIndex(doc), res.start, res.end) },
      highlight: { rects, scope: res.scope }, createdAt: now, updatedAt: now,
    }
    layer.upsert(a)
    history.push({ undo: () => layer.remove(a.id), redo: () => layer.restore(a.id) })
  }

  function tapNote(p: InkPoint) {
    const near = layer.hit(p.x, p.y, TAP_PX / viewer.scale).map((id) => layer.get(id)).find((a) => a?.kind === 'note')
    if (near) { openNote.value = near.id; return }
    if (!doc) return
    const anchor: Annotation['anchor'] = { page: { x: p.x, y: p.y } }
    const el = elementAnchor(doc, p.x, p.y)
    if (el) anchor.element = el
    const off = caretOffset(doc, p.x, p.y)
    if (off !== null) {
      const idx = textIndex(doc)
      const [s, e] = wordBounds(idx.text, off, off)
      if (e > s) anchor.text = describeText(idx, s, e)
    }
    const now = new Date().toISOString()
    const m = meaning.value
    const a: Annotation = { id: crypto.randomUUID(), pageId, kind: 'note', layer: 'notes', color: colorOf(m), meaning: m, anchor, note: { text: '' }, createdAt: now, updatedAt: now }
    layer.upsert(a)
    history.push({ undo: () => { layer.remove(a.id); if (openNote.value === a.id) openNote.value = null }, redo: () => layer.restore(a.id) })
    openNote.value = a.id
  }

  const pointer = attachPointer(viewer, {
    active: () => mode.value === 'markup',
    finger: () => drawWithFinger.value,
    handler: {
      down(p) {
        const t = tool.value
        if (t === 'eraser') { erased = []; eraseAt(p); return }
        if (t === 'note') { tapNote(p); return }
        if (t === 'mark') {
          session = doc ? startMark(doc, p.x, p.y) : null
          last = p
          if (session) { layer.preview(session.rects(), colorOf(meaning.value)); armDwell() }
          return
        }
        points = [p]
      },
      move(ps, predicted) {
        const t = tool.value
        if (t === 'eraser') { ps.forEach(eraseAt); return }
        if (t === 'note') return
        if (t === 'mark') {
          const p = ps[ps.length - 1]
          if (!session) return
          session.update(p.x, p.y)
          layer.preview(session.rects(), colorOf(meaning.value))
          if (last && Math.hypot(p.x - last.x, p.y - last.y) * viewer.scale > 4) { last = p; armDwell() } // still moving: restart the hold timer
          return
        }
        points.push(...ps)
        showLive(predicted)
      },
      end() {
        const t = tool.value
        if (t === 'note') return
        if (t === 'mark') { commitMark(); return }
        if (t === 'eraser') {
          const ids = [...new Set(erased)]
          erased = []
          if (ids.length) history.push({ undo: () => ids.forEach(layer.restore), redo: () => ids.forEach(layer.remove) })
          return
        }
        const kind = t === 'highlighter' ? 'highlighter' : 'pen'
        const built = buildStroke(points, kind, effectiveSize())
        points = []
        live.clear()
        if (!built) return
        const now = new Date().toISOString()
        const a: Annotation = {
          id: crypto.randomUUID(), pageId, kind: 'ink', layer: 'ink', color: color.value,
          anchor: { page: built.origin }, ink: built.stroke, layoutAt: viewer.layoutWidth, createdAt: now, updatedAt: now,
        }
        const b = built.stroke.bbox
        if (viewer.lane && b.x + b.w / 2 > viewer.layoutWidth) {
          a.lane = 'margin'
          const css = doc ? leaderTarget(doc, b.y + b.h / 2, viewer.layoutWidth) : null
          const top = css && doc ? resolveCss(css, doc)?.getBoundingClientRect().top : undefined
          if (css) a.leader = { css, top }
        } else if (doc) {
          const el = elementAnchor(doc, built.origin.x, built.origin.y)
          if (el) a.anchor.element = el
        }
        layer.upsert(a)
        history.push({ undo: () => layer.remove(a.id), redo: () => layer.restore(a.id) })
      },
    },
  })
  const stopEffect = effect(() => {
    void mode.value
    void drawWithFinger.value
    pointer.sync()
  })
  attachTapGestures(viewer.container, { undo: () => history.undo(), redo: () => history.redo() })
  const unzoom = bindZoom(viewer)

  // ---- what the panels use
  const reveal = (id: string) => {
    const rects = layer.rectsOf(id)
    const pt = layer.pointOf(id)
    const y = rects[0]?.y ?? pt.y
    viewer.container.scrollTo({ top: Math.max(0, y * viewer.scale - viewer.container.clientHeight / 3), behavior: 'smooth' })
    layer.pulse(rects, pt)
  }
  marksApi.reveal = reveal
  marksApi.updateNote = (id, text) => {
    const a = layer.get(id)
    if (a) layer.upsert({ ...a, note: { text }, updatedAt: new Date().toISOString() })
  }
  marksApi.setMeaning = (id, m) => {
    const a = layer.get(id)
    if (a) layer.upsert({ ...a, meaning: m, color: colorOf(m), updatedAt: new Date().toISOString() })
  }
  marksApi.remove = (id) => {
    layer.remove(id)
    history.push({ undo: () => layer.restore(id), redo: () => layer.remove(id) })
    if (openNote.value === id) openNote.value = null
    if (spotlightId.value === id) marksApi.spotlight(null)
  }
  marksApi.spotlight = (id) => {
    spotlightId.value = id
    layer.spotlight(id ? layer.rectsOf(id) : null)
    if (id) reveal(id)
  }
  // any tap or key press ends the spotlight; scrolling and pinching still work underneath it
  const tapAway = (e: Event) => {
    if (!spotlightId.value) return
    e.stopImmediatePropagation() // that tap only ends the spotlight; it must not also start a mark or a note
    marksApi.spotlight(null)
  }
  const onKey = (e: KeyboardEvent) => e.key === 'Escape' && spotlightId.value && marksApi.spotlight(null)
  viewer.container.addEventListener('pointerdown', tapAway, true)
  document.addEventListener('keydown', onKey)

  return {
    setLane: (on: boolean) => viewer.setLane(on),
    destroy() {
      flush()
      clearTimeout(dwell)
      stopEffect()
      pointer.destroy()
      unzoom()
      viewer.container.removeEventListener('pointerdown', tapAway, true)
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('visibilitychange', onHide)
      removeEventListener('pagehide', flush)
      Object.assign(marksApi, { reveal() {}, updateNote() {}, setMeaning() {}, remove() {}, spotlight() {} })
      marks.value = []
      openNote.value = null
      spotlightId.value = null
    },
  }
}
