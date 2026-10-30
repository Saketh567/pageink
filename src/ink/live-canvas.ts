/**
 * A canvas that shows the stroke being drawn right now; finished ink becomes SVG (iOS limits canvas size).
 */
import type { Viewer } from '../viewer/viewer.ts'
import { outlinePath, type InkPoint } from './stroke.ts'
import type { Stroke } from '../store/schema.ts'

interface Job { points: InkPoint[]; predicted: InkPoint[]; tool: Stroke['tool']; size: number; color: string }

/** Viewport-sized canvas for the stroke in progress; committed ink is SVG (iOS caps canvas area). */
export function createLiveCanvas(viewer: Viewer) {
  const canvas = viewer.canvas
  const ctx = canvas.getContext('2d', { desynchronized: true })!
  let dpr = 1
  let job: Job | null = null
  let raf = 0

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = viewer.container.clientWidth * dpr
    canvas.height = viewer.container.clientHeight * dpr
    schedule()
  }
  function draw() {
    raf = 0
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (!job || job.points.length < 2) return
    const { x: ox, y: oy } = viewer.contentOffset()
    const s = viewer.scale * dpr
    ctx.setTransform(s, 0, 0, s, (ox - viewer.container.scrollLeft) * dpr, (oy - viewer.container.scrollTop) * dpr)
    ctx.globalAlpha = job.tool === 'highlighter' ? 0.35 : 1
    ctx.fillStyle = job.color
    // predicted points only extend what is drawn; they are never stored
    ctx.fill(new Path2D(outlinePath([...job.points, ...job.predicted], job.tool, job.size)))
  }
  function schedule() {
    if (!raf) raf = requestAnimationFrame(draw)
  }

  new ResizeObserver(resize).observe(viewer.container)
  viewer.onViewChange(schedule)
  resize()

  return {
    show(j: Job) { job = j; schedule() },
    clear() { job = null; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height) },
  }
}
