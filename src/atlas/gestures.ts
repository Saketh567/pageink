/**
 * How the desk answers fingers, the Pencil, a mouse and the keyboard: drag the empty desk to pan (with momentum), pinch or turn the
 * wheel to zoom around the fingers, drag a card to move it, double-tap a card to dive into it. Touches on the glass controls are
 * left alone. The caller supplies a small interface (the camera, what is under a touch, what to do with a moved card).
 */
import type { Camera } from '../store/schema.ts'
import { panBy, zoomAt } from './camera.ts'

export interface GestureApi {
  cam(): Camera
  setCam(c: Camera): void
  /** True while a page is open over the desk: the desk then ignores input. */
  locked(): boolean
  /** The card (or frame handle) a touch landed on, or null for empty desk. */
  cardAt(target: Element): { id: string } | null
  cardLift(id: string, on: boolean): void
  /** Move a card by a distance in board units. */
  cardMove(id: string, dx: number, dy: number): void
  cardDrop(id: string): void
  dive(id: string): void
  /** Stop any camera flight in progress: the person has taken over. */
  stopFlight(): void
  fit(): void
}

const DRAG_SLOP = 6
const DOUBLE_MS = 320
const FRICTION = 0.94 // per 16.7 ms, as in the design

export function attachGestures(el: HTMLElement, api: GestureApi) {
  const ptrs = new Map<number, { x: number; y: number }>()
  let drag: { id: string; pid: number; sx: number; sy: number; moved: boolean } | null = null
  let vel = { x: 0, y: 0, t: 0 }
  let pinch: { d: number; mx: number; my: number } | null = null
  let tap = { id: '', t: 0, x: 0, y: 0 }
  let glide = 0

  const stopGlide = () => { cancelAnimationFrame(glide); glide = 0 }
  const startGlide = () => {
    let last = performance.now()
    const step = (now: number) => {
      const dt = Math.min(48, now - last)
      last = now
      vel.x *= FRICTION ** (dt / 16.7)
      vel.y *= FRICTION ** (dt / 16.7)
      if (Math.hypot(vel.x, vel.y) < 0.02) return void (glide = 0)
      api.setCam(panBy(api.cam(), vel.x * dt, vel.y * dt))
      glide = requestAnimationFrame(step)
    }
    glide = requestAnimationFrame(step)
  }

  const onDown = (e: PointerEvent) => {
    const t = e.target as Element
    if (api.locked() || t.closest('[data-chrome]') || t.closest('.dive')) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    stopGlide()
    api.stopFlight()
    el.setPointerCapture(e.pointerId)
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (ptrs.size === 1) {
      const hit = api.cardAt(t)
      drag = hit ? { id: hit.id, pid: e.pointerId, sx: e.clientX, sy: e.clientY, moved: false } : null
      vel = { x: 0, y: 0, t: e.timeStamp }
    } else {
      // a second finger turns whatever was happening into a pinch
      if (drag?.moved) { api.cardLift(drag.id, false); api.cardDrop(drag.id) }
      drag = null
      const [a, b] = [...ptrs.values()]
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }
    }
  }

  const onMove = (e: PointerEvent) => {
    const p = ptrs.get(e.pointerId)
    if (!p) return
    const dx = e.clientX - p.x
    const dy = e.clientY - p.y
    p.x = e.clientX
    p.y = e.clientY
    if (ptrs.size >= 2) {
      const [a, b] = [...ptrs.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1
      const mx = (a.x + b.x) / 2
      const my = (a.y + b.y) / 2
      if (pinch) api.setCam(panBy(zoomAt(api.cam(), { x: mx, y: my }, d / pinch.d), mx - pinch.mx, my - pinch.my))
      pinch = { d, mx, my }
      return
    }
    if (drag) {
      if (!drag.moved) {
        if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < DRAG_SLOP) return
        drag.moved = true
        api.cardLift(drag.id, true)
      }
      const z = api.cam().z
      api.cardMove(drag.id, dx / z, dy / z)
      return
    }
    api.setCam(panBy(api.cam(), dx, dy))
    const dt = e.timeStamp - vel.t
    if (dt > 0) { vel = { x: 0.7 * vel.x + 0.3 * (dx / dt), y: 0.7 * vel.y + 0.3 * (dy / dt), t: e.timeStamp } }
  }

  const onUp = (e: PointerEvent) => {
    if (!ptrs.delete(e.pointerId)) return
    if (ptrs.size < 2) pinch = null
    if (drag && drag.pid === e.pointerId) {
      if (drag.moved) {
        api.cardLift(drag.id, false)
        api.cardDrop(drag.id)
      } else {
        // a still touch on a card: two of them close together mean "go in"
        const close = tap.id === drag.id && e.timeStamp - tap.t < DOUBLE_MS && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < 28
        if (close) { tap = { id: '', t: 0, x: 0, y: 0 }; api.dive(drag.id) } else tap = { id: drag.id, t: e.timeStamp, x: e.clientX, y: e.clientY }
      }
      drag = null
      return
    }
    if (ptrs.size === 0 && Math.hypot(vel.x, vel.y) > 0.05 && e.timeStamp - vel.t < 80) startGlide()
  }

  const onWheel = (e: WheelEvent) => {
    if (api.locked() || (e.target as Element).closest('[data-chrome]') || (e.target as Element).closest('.dive')) return
    e.preventDefault()
    stopGlide()
    api.stopFlight()
    if (e.shiftKey) return api.setCam(panBy(api.cam(), -e.deltaY, 0))
    if (!e.ctrlKey && Math.abs(e.deltaX) > Math.abs(e.deltaY)) return api.setCam(panBy(api.cam(), -e.deltaX, 0)) // a sideways trackpad swipe pans
    // a pinch on a trackpad arrives as ctrl+wheel with small steps; a mouse wheel notch is about 1.12x
    api.setCam(zoomAt(api.cam(), { x: e.clientX, y: e.clientY }, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015))))
  }

  const onKey = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement
    if (api.locked() || t.closest('input, textarea, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return
    const centre = { x: el.clientWidth / 2, y: el.clientHeight / 2 }
    if (e.key === '0') api.fit()
    else if (e.key === '+' || e.key === '=') api.setCam(zoomAt(api.cam(), centre, 1.25))
    else if (e.key === '-') api.setCam(zoomAt(api.cam(), centre, 1 / 1.25))
    else if (e.key === 'ArrowLeft') api.setCam(panBy(api.cam(), 80, 0))
    else if (e.key === 'ArrowRight') api.setCam(panBy(api.cam(), -80, 0))
    else if (e.key === 'ArrowUp') api.setCam(panBy(api.cam(), 0, 80))
    else if (e.key === 'ArrowDown') api.setCam(panBy(api.cam(), 0, -80))
    else return
    e.preventDefault()
  }

  el.addEventListener('pointerdown', onDown)
  el.addEventListener('pointermove', onMove)
  el.addEventListener('pointerup', onUp)
  el.addEventListener('pointercancel', onUp)
  el.addEventListener('wheel', onWheel, { passive: false })
  addEventListener('keydown', onKey)
  return () => {
    stopGlide()
    el.removeEventListener('pointerdown', onDown)
    el.removeEventListener('pointermove', onMove)
    el.removeEventListener('pointerup', onUp)
    el.removeEventListener('pointercancel', onUp)
    el.removeEventListener('wheel', onWheel)
    removeEventListener('keydown', onKey)
  }
}
