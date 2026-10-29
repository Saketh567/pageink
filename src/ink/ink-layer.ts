import type { Annotation } from '../store/schema.ts'
import { hitsInk } from './eraser.ts'
import { absPoints, outlinePath } from './stroke.ts'

const SVG_NS = 'http://www.w3.org/2000/svg'

/** Committed annotations as SVG paths, plus the in-memory list they were drawn from. */
export function createInkLayer(svg: SVGSVGElement, onChange: (ids: string[]) => void) {
  const items = new Map<string, Annotation>()
  const nodes = new Map<string, SVGElement>()
  const groups = new Map<string, SVGGElement>()

  function group(layer: string) {
    let g = groups.get(layer)
    if (!g) {
      g = document.createElementNS(SVG_NS, 'g')
      g.dataset.layer = layer
      svg.append(g)
      groups.set(layer, g)
    }
    return g
  }

  function paint(a: Annotation) {
    nodes.get(a.id)?.remove()
    nodes.delete(a.id)
    if (a.deleted || !a.ink) return
    const path = document.createElementNS(SVG_NS, 'path')
    path.dataset.id = a.id
    path.setAttribute('d', a.ink.path ?? outlinePath(absPoints(a), a.ink.tool, a.ink.size))
    path.setAttribute('fill', a.color)
    if (a.ink.tool === 'highlighter') {
      path.style.opacity = '0.35'
      path.style.mixBlendMode = 'multiply'
    }
    group(a.layer).append(path)
    nodes.set(a.id, path)
  }

  function set(a: Annotation) {
    items.set(a.id, a)
    paint(a)
    onChange([a.id])
  }

  return {
    load(list: Annotation[]) {
      for (const a of list) { items.set(a.id, a); paint(a) }
    },
    upsert: set,
    remove(id: string) {
      const a = items.get(id)
      if (a) set({ ...a, deleted: true, updatedAt: new Date().toISOString() })
    },
    restore(id: string) {
      const a = items.get(id)
      if (a) { const { deleted: _d, ...rest } = a; set({ ...rest, updatedAt: new Date().toISOString() }) }
    },
    get: (id: string) => items.get(id),
    /** Ids of live ink under an eraser of `radius` doc px at (x, y). */
    hit(x: number, y: number, radius: number) {
      return [...items.values()].filter((a) => hitsInk(a, x, y, radius)).map((a) => a.id)
    },
  }
}
