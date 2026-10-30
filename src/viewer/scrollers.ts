import type { Viewer } from './viewer.ts'

/** The nearest box around `el` that scrolls sideways and can still move that way (a carousel, a wide table). */
function sideScroller(el: Element | null, toward: number): HTMLElement | null {
  const win = el?.ownerDocument.defaultView
  if (!win) return null
  for (let e: Element | null = el; e && e !== e.ownerDocument.body; e = e.parentElement) {
    const h = e as HTMLElement
    if (h.scrollWidth <= h.clientWidth + 1) continue
    const o = win.getComputedStyle(h).overflowX
    if (o !== 'auto' && o !== 'scroll') continue
    const atStart = h.scrollLeft <= 0
    const atEnd = h.scrollLeft + h.clientWidth >= h.scrollWidth - 1
    if ((toward < 0 && !atStart) || (toward > 0 && !atEnd)) return h
  }
  return null
}

/**
 * Carousels and wide tables inside a page scroll sideways. The page itself never gets pointer events (the viewer does), so a sideways
 * swipe or wheel turn over such a box is passed to it by hand. Marks follow, because the viewer re-anchors them on every scroll.
 */
export function attachSideScroll(viewer: Viewer, enabled: () => boolean) {
  const c = viewer.container
  const under = (cx: number, cy: number) => {
    const doc = viewer.iframe.contentDocument
    if (!doc) return null
    const p = viewer.clientToDoc(cx, cy)
    return doc.elementFromPoint(p.x, p.y)
  }

  let lastX = 0, lastY = 0, target: Element | null = null, owner: HTMLElement | null = null, decided = false
  const start = (e: TouchEvent) => {
    decided = false
    owner = null
    if (e.touches.length !== 1 || !enabled()) return
    const t = e.touches[0]
    lastX = t.clientX
    lastY = t.clientY
    target = under(t.clientX, t.clientY)
  }
  const move = (e: TouchEvent) => {
    if (e.touches.length !== 1 || !target) return
    const t = e.touches[0]
    const dx = t.clientX - lastX
    const dy = t.clientY - lastY
    if (!decided) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return
      decided = true
      owner = Math.abs(dx) > Math.abs(dy) ? sideScroller(target, -dx) : null // mostly sideways over a carousel: it takes the swipe
    }
    if (!owner) return
    if (e.cancelable) e.preventDefault()
    owner.scrollLeft -= dx / viewer.scale
    viewer.follow()
    lastX = t.clientX
    lastY = t.clientY
  }
  const wheel = (e: WheelEvent) => {
    if (e.ctrlKey) return // pinch-zoom on a trackpad
    const dx = e.deltaX || (e.shiftKey ? e.deltaY : 0)
    if (!dx || Math.abs(dx) < Math.abs(e.deltaY) && !e.shiftKey) return
    const box = sideScroller(under(e.clientX, e.clientY), dx)
    if (!box) return
    e.preventDefault()
    box.scrollLeft += dx / viewer.scale
    viewer.follow()
  }

  c.addEventListener('touchstart', start, { passive: true })
  c.addEventListener('touchmove', move, { passive: false })
  c.addEventListener('wheel', wheel, { passive: false })
  return () => {
    c.removeEventListener('touchstart', start)
    c.removeEventListener('touchmove', move)
    c.removeEventListener('wheel', wheel)
  }
}
