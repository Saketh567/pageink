import type { Viewer } from './viewer.ts'

interface WebKitGesture extends Event { scale: number; clientX: number; clientY: number }

/** Pinch zoom of the content only: WebKit gesture events on iPad, ctrl+wheel (trackpad pinch) elsewhere. */
export function bindZoom(viewer: Viewer): () => void {
  const c = viewer.container
  let start = 1
  const gs = (e: Event) => { e.preventDefault(); start = viewer.scale }
  const gc = (e: Event) => {
    e.preventDefault()
    const g = e as WebKitGesture
    viewer.setScale(start * g.scale, g.clientX ? { x: g.clientX, y: g.clientY } : undefined)
  }
  const wheel = (e: WheelEvent) => {
    if (!e.ctrlKey) return
    e.preventDefault()
    viewer.setScale(viewer.scale * Math.exp(-e.deltaY / 100), { x: e.clientX, y: e.clientY })
  }
  c.addEventListener('gesturestart', gs)
  c.addEventListener('gesturechange', gc)
  c.addEventListener('gestureend', gs)
  c.addEventListener('wheel', wheel, { passive: false })
  return () => {
    c.removeEventListener('gesturestart', gs)
    c.removeEventListener('gesturechange', gc)
    c.removeEventListener('gestureend', gs)
    c.removeEventListener('wheel', wheel)
  }
}
