/**
 * Input routing: the Pencil (or a mouse) draws, a finger scrolls and taps. Also two-finger tap for undo and
 * three-finger tap for redo.
 */
import type { Viewer } from '../viewer/viewer.ts'
import type { InkPoint } from './stroke.ts'

interface InkHandler {
  down(p: InkPoint): void
  move(points: InkPoint[], predicted: InkPoint[]): void
  end(): void
}

interface Opts { active(): boolean; finger(): boolean; handler: InkHandler }

type TouchWithType = Touch & { touchType?: string }

/**
 * Input routing, option A (see docs/DECISIONS.md): the pen draws, touch scrolls natively.
 * Stylus touches are cancelled at the touch level so the Pencil can never scroll or zoom.
 */
export function attachPointer(viewer: Viewer, opts: Opts) {
  const c = viewer.container
  let drawing: number | null = null
  let penSeen = false

  const toPoint = (e: PointerEvent, rect: DOMRect, pen: boolean): InkPoint => {
    const x = (e.clientX - rect.left) / viewer.scale
    const y = (e.clientY - rect.top) / viewer.scale
    return { x, y, p: pen ? e.pressure || 0.5 : 0.5, t: e.timeStamp }
  }
  const rectOf = () => viewer.container.querySelector('.viewer-sizer')!.getBoundingClientRect()

  const down = (e: PointerEvent) => {
    if (!opts.active() || drawing !== null) return
    const pen = e.pointerType === 'pen'
    if (pen) penSeen = true
    if (e.pointerType === 'touch' && (!opts.finger() || penSeen)) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    drawing = e.pointerId
    c.setPointerCapture(e.pointerId)
    e.preventDefault()
    opts.handler.down(toPoint(e, rectOf(), pen))
  }
  const move = (e: PointerEvent) => {
    if (e.pointerId !== drawing) return
    const rect = rectOf()
    const pen = e.pointerType === 'pen'
    const co = e.getCoalescedEvents?.() ?? []
    const pts = (co.length ? co : [e]).map((ce) => toPoint(ce, rect, pen))
    const predicted = (e.getPredictedEvents?.() ?? []).map((pe) => toPoint(pe, rect, pen))
    opts.handler.move(pts, predicted)
  }
  const up = (e: PointerEvent) => {
    if (e.pointerId !== drawing) return
    drawing = null
    if (e.pointerType === 'pen') setTimeout(() => (penSeen = false), 600)
    opts.handler.end()
  }
  const blockStylus = (e: TouchEvent) => {
    if (!opts.active()) return
    for (const t of Array.from(e.changedTouches) as TouchWithType[]) {
      if (t.touchType === 'stylus') { e.preventDefault(); return }
    }
  }

  c.addEventListener('pointerdown', down)
  c.addEventListener('pointermove', move)
  c.addEventListener('pointerup', up)
  c.addEventListener('pointercancel', up)
  c.addEventListener('touchstart', blockStylus, { passive: false })
  c.addEventListener('touchmove', blockStylus, { passive: false })

  return {
    /** Re-apply touch-action after the mode or the draw-with-finger setting changes. */
    sync() {
      c.style.touchAction = opts.active() && opts.finger() ? 'none' : 'pan-x pan-y'
    },
    destroy() {
      c.removeEventListener('pointerdown', down)
      c.removeEventListener('pointermove', move)
      c.removeEventListener('pointerup', up)
      c.removeEventListener('pointercancel', up)
      c.removeEventListener('touchstart', blockStylus)
      c.removeEventListener('touchmove', blockStylus)
    },
  }
}

/** Two-finger tap = undo, three-finger tap = redo (under 250 ms, under 10 px of movement). */
export function attachTapGestures(c: HTMLElement, act: { undo(): void; redo(): void }) {
  const start = new Map<number, [number, number]>()
  let t0 = 0
  let max = 0
  let moved = false
  c.addEventListener('touchstart', (e) => {
    if (e.touches.length === e.changedTouches.length) { t0 = e.timeStamp; max = 0; moved = false; start.clear() }
    for (const t of Array.from(e.changedTouches) as TouchWithType[]) {
      if (t.touchType === 'stylus') moved = true
      start.set(t.identifier, [t.clientX, t.clientY])
    }
    max = Math.max(max, e.touches.length)
  }, { passive: true })
  c.addEventListener('touchmove', (e) => {
    for (const t of Array.from(e.changedTouches)) {
      const s = start.get(t.identifier)
      if (s && Math.hypot(t.clientX - s[0], t.clientY - s[1]) > 10) moved = true
    }
  }, { passive: true })
  c.addEventListener('touchend', (e) => {
    if (e.touches.length || moved || e.timeStamp - t0 > 250) return
    if (max === 2) act.undo()
    else if (max === 3) act.redo()
  }, { passive: true })
}
