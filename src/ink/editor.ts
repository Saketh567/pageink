import { effect } from '@preact/signals'
import { putAnnotation } from '../store/repo.ts'
import type { Annotation } from '../store/schema.ts'
import { actions, canRedo, canUndo, color, drawWithFinger, mode, size, tool } from '../ui/state.ts'
import type { Viewer } from '../viewer/viewer.ts'
import { bindZoom } from '../viewer/zoom.ts'
import { createHistory } from './history.ts'
import { createInkLayer } from './ink-layer.ts'
import { createLiveCanvas } from './live-canvas.ts'
import { attachPointer, attachTapGestures } from './pointer.ts'
import { buildStroke, type InkPoint } from './stroke.ts'

const ERASER_SCREEN_PX = 10
const HIGHLIGHTER_FACTOR = 4

/** Wires pointer input to the live canvas, the SVG layer, undo history and autosave. */
export function createEditor(viewer: Viewer, pageId: string, initial: Annotation[]) {
  const dirty = new Set<string>()
  let timer: ReturnType<typeof setTimeout> | undefined
  const layer = createInkLayer(viewer.svg, (ids) => {
    ids.forEach((id) => dirty.add(id))
    clearTimeout(timer)
    timer = setTimeout(flush, 300)
  })
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
  const history = createHistory(() => {
    canUndo.value = history.canUndo()
    canRedo.value = history.canRedo()
  })
  actions.undo = () => history.undo()
  actions.redo = () => history.redo()
  const live = createLiveCanvas(viewer)

  let points: InkPoint[] = []
  let erased: string[] = []

  const eraseAt = (p: InkPoint) => {
    for (const id of layer.hit(p.x, p.y, ERASER_SCREEN_PX / viewer.scale)) {
      layer.remove(id)
      erased.push(id)
    }
  }
  const effectiveSize = () => (tool.value === 'highlighter' ? size.value * HIGHLIGHTER_FACTOR : size.value)
  const showLive = (predicted: InkPoint[] = []) =>
    live.show({ points, predicted, tool: tool.value === 'highlighter' ? 'highlighter' : 'pen', size: effectiveSize(), color: color.value })

  const pointer = attachPointer(viewer, {
    active: () => mode.value === 'markup',
    finger: () => drawWithFinger.value,
    handler: {
      down(p) {
        if (tool.value === 'eraser') { erased = []; eraseAt(p); return }
        points = [p]
      },
      move(ps, predicted) {
        if (tool.value === 'eraser') { ps.forEach(eraseAt); return }
        points.push(...ps)
        showLive(predicted)
      },
      end() {
        if (tool.value === 'eraser') {
          const ids = [...new Set(erased)]
          erased = []
          if (ids.length) history.push({ undo: () => ids.forEach(layer.restore), redo: () => ids.forEach(layer.remove) })
          return
        }
        const kind = tool.value === 'highlighter' ? 'highlighter' : 'pen'
        const built = buildStroke(points, kind, effectiveSize())
        points = []
        live.clear()
        if (!built) return
        const now = new Date().toISOString()
        const a: Annotation = {
          id: crypto.randomUUID(), pageId, kind: 'ink', layer: 'ink', color: color.value,
          anchor: { page: built.origin }, ink: built.stroke, createdAt: now, updatedAt: now,
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

  return {
    destroy() {
      flush()
      stopEffect()
      pointer.destroy()
      unzoom()
      document.removeEventListener('visibilitychange', onHide)
      removeEventListener('pagehide', flush)
    },
  }
}
