import { resolveAnnotation, type Resolved } from '../anchor/anchor.ts'
import { elementPoint, resolve as resolveCss } from '../anchor/css-selector.ts'
import type { Mark } from '../export/study-sheet.ts'
import type { Annotation, Rect } from '../store/schema.ts'
import { hitsInk } from './eraser.ts'
import { absPoints, outlinePath } from './stroke.ts'

const SVG_NS = 'http://www.w3.org/2000/svg'
const PIN_R = 12
/** Ink drawn before layouts could change was always drawn at the old fixed desktop width. */
const LEGACY_WIDTH = 1280

const isAnchored = (a: Annotation) => a.kind === 'highlight' || a.kind === 'note'

/** Committed annotations as SVG, plus the in-memory list they were drawn from and where each one currently is. */
export function createInkLayer(svg: SVGSVGElement, onChange: (ids: string[]) => void, getWidth: () => number = () => LEGACY_WIDTH) {
  const items = new Map<string, Annotation>()
  const nodes = new Map<string, SVGElement>()
  const resolved = new Map<string, Resolved>()
  const groups = new Map<string, SVGGElement>()
  let doc: Document | null = null
  let liveGroup: SVGGElement | null = null
  let spot: SVGPathElement | null = null

  const make = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, parent?: Element) => {
    const e = document.createElementNS(SVG_NS, tag)
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v))
    parent?.append(e)
    return e
  }

  function group(layer: string) {
    let g = groups.get(layer)
    if (!g) {
      g = make('g', {}, svg)
      g.dataset.layer = layer
      groups.set(layer, g)
      if (spot) svg.append(spot) // the spotlight dimmer always stays on top
    }
    return g
  }

  /**
   * How far ink has to move to stay with its content after the layout changed (rotation, Split View, late images).
   * Ink drawn on the page follows the element it was drawn on; margin ink stays beside the page edge and follows its paragraph.
   */
  function inkOffset(a: Annotation): { dx: number; dy: number } {
    if (!doc) return { dx: 0, dy: 0 }
    if (a.lane === 'margin') {
      const dx = getWidth() - (a.layoutAt ?? LEGACY_WIDTH)
      const target = a.leader ? resolveCss(a.leader.css, doc) : null
      const dy = target && a.leader?.top !== undefined ? target.getBoundingClientRect().top - a.leader.top : 0
      return { dx, dy }
    }
    const p = a.anchor.element ? elementPoint(doc, a.anchor.element) : null
    if (!p) return { dx: 0, dy: 0 }
    const dx = p.x - a.anchor.page.x
    const dy = p.y - a.anchor.page.y
    return Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 ? { dx: 0, dy: 0 } : { dx, dy }
  }

  const drop = (key: string) => { nodes.get(key)?.remove(); nodes.delete(key) }

  function paintRects(a: Annotation, parent: SVGGElement, r: Resolved) {
    const g = make('g', {}, parent)
    g.dataset.id = a.id
    g.style.mixBlendMode = 'multiply'
    g.style.opacity = '0.4'
    for (const q of r.rects) {
      const rect = make('rect', { x: q.x - 1, y: q.y, width: q.w + 2, height: q.h, rx: 3, fill: r.orphaned ? 'none' : a.color }, g)
      if (r.orphaned) { rect.setAttribute('stroke', a.color); rect.setAttribute('stroke-dasharray', '4 3'); rect.setAttribute('stroke-width', '2') }
    }
    nodes.set(a.id, g)
  }

  function paintPin(a: Annotation, parent: SVGGElement, r: Resolved) {
    const g = make('g', { transform: `translate(${r.point.x} ${r.point.y})` }, parent)
    g.dataset.id = a.id
    g.classList.add('pin')
    make('circle', { r: PIN_R, fill: a.color, stroke: '#fff', 'stroke-width': 2.5 }, g)
    make('path', { d: 'M-5 -3h10M-5 1h6', stroke: '#0008', 'stroke-width': 2, 'stroke-linecap': 'round', fill: 'none' }, g)
    if (r.orphaned) g.style.opacity = '0.6'
    nodes.set(a.id, g)
  }

  function paintLeader(a: Annotation, parent: SVGGElement) {
    if (!doc || !a.leader || !a.ink) return
    const target = resolveCss(a.leader.css, doc)
    if (!target) return
    const t = target.getBoundingClientRect()
    const b = a.ink.bbox
    const o = inkOffset(a)
    const x1 = b.x + o.dx
    const y1 = b.y + b.h / 2 + o.dy
    const x2 = t.right
    const y2 = Math.min(Math.max(y1, t.top + 6), t.bottom - 6) // end level with the scribble, inside the paragraph
    const mid = (x1 + x2) / 2
    const path = make('path', { d: `M${x1} ${y1} C${mid} ${y1} ${mid} ${y2} ${x2} ${y2}`, fill: 'none', stroke: a.color, 'stroke-width': 1.6, 'stroke-linecap': 'round', opacity: 0.5 }, parent)
    path.dataset.leaderFor = a.id
    nodes.set(a.id + ':leader', path)
  }

  function paint(a: Annotation) {
    drop(a.id)
    drop(a.id + ':leader')
    if (a.deleted) return
    if (a.kind === 'ink' && a.ink) {
      const g = group(a.layer)
      const path = make('path', { d: a.ink.path ?? outlinePath(absPoints(a), a.ink.tool, a.ink.size), fill: a.color }, g)
      path.dataset.id = a.id
      const o = inkOffset(a)
      if (o.dx || o.dy) path.setAttribute('transform', `translate(${o.dx} ${o.dy})`)
      if (a.ink.tool === 'highlighter') {
        path.style.opacity = '0.35'
        path.style.mixBlendMode = 'multiply'
      }
      nodes.set(a.id, path)
      if (a.lane === 'margin') paintLeader(a, g)
    } else if (a.kind === 'highlight') {
      const r = resolved.get(a.id) ?? { rects: a.highlight?.rects ?? [], point: a.anchor.page, orphaned: false }
      paintRects(a, group('highlights'), r)
    } else if (a.kind === 'note') {
      paintPin(a, group('notes'), resolved.get(a.id) ?? { rects: [], point: a.anchor.page, orphaned: false })
    }
  }

  const resolveOne = (a: Annotation) => { if (doc && isAnchored(a)) resolved.set(a.id, resolveAnnotation(a, doc)) }

  function set(a: Annotation) {
    items.set(a.id, a)
    resolveOne(a)
    paint(a)
    onChange([a.id])
  }

  function reresolve() {
    for (const a of items.values()) {
      if (a.deleted) continue
      resolveOne(a)
      if (isAnchored(a) || a.kind === 'ink') paint(a)
    }
  }

  const inflate = (r: Rect, by: number) => ({ x: r.x - by, y: r.y - by, w: r.w + by * 2, h: r.h + by * 2 })

  return {
    load(list: Annotation[]) {
      for (const a of list) { items.set(a.id, a); paint(a) }
    },
    /** Attach the snapshot document: highlights and notes now find their words and elements. */
    setDoc(d: Document) { doc = d; reresolve() },
    reresolve,
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
    rectsOf: (id: string) => resolved.get(id)?.rects ?? [],
    pointOf: (id: string) => resolved.get(id)?.point ?? items.get(id)?.anchor.page ?? { x: 0, y: 0 },
    /** Highlights and notes in reading order, flagged if their words could not be found. */
    marks(): Mark[] {
      return [...items.values()]
        .filter((a) => !a.deleted && isAnchored(a))
        .map((a) => {
          const r = resolved.get(a.id)
          return { a, orphaned: !!r?.orphaned, x: r?.rects[0]?.x ?? r?.point.x ?? a.anchor.page.x, y: r?.rects[0]?.y ?? r?.point.y ?? a.anchor.page.y }
        })
        .sort((p, q) => p.y - q.y)
    },
    /** Ids of anything under an eraser (or tap) of `radius` doc px at (x, y). */
    hit(x: number, y: number, radius: number) {
      const out: string[] = []
      for (const a of items.values()) {
        if (a.deleted) continue
        if (a.kind === 'ink') { const o = inkOffset(a); if (hitsInk(a, x - o.dx, y - o.dy, radius)) out.push(a.id) }
        else if (a.kind === 'highlight') {
          if (resolved.get(a.id)?.rects.some((r) => { const q = inflate(r, radius); return x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h })) out.push(a.id)
        } else if (a.kind === 'note') {
          const p = resolved.get(a.id)?.point ?? a.anchor.page
          if (Math.hypot(x - p.x, y - p.y) <= radius + PIN_R) out.push(a.id)
        }
      }
      return out
    },
    /** Live outline while dragging a text selection. */
    preview(rects: Rect[] | null, color = '#ffd60a') {
      if (!rects) { liveGroup?.remove(); liveGroup = null; return }
      if (!liveGroup) { liveGroup = make('g', {}, svg); liveGroup.style.opacity = '0.4'; liveGroup.style.mixBlendMode = 'multiply' }
      liveGroup.replaceChildren()
      for (const q of rects) make('rect', { x: q.x - 1, y: q.y, width: q.w + 2, height: q.h, rx: 3, fill: color }, liveGroup)
    },
    /** Dim everything except these rectangles; null clears it. */
    spotlight(rects: Rect[] | null) {
      spot?.remove()
      spot = null
      if (!rects?.length) return
      const w = Number(svg.getAttribute('width'))
      const h = Number(svg.getAttribute('height'))
      const holes = rects.map((r) => { const q = inflate(r, 6); return `M${q.x} ${q.y}h${q.w}v${q.h}h${-q.w}Z` }).join('')
      spot = make('path', { d: `M0 0H${w}V${h}H0Z${holes}`, 'fill-rule': 'evenodd', fill: 'rgba(0,0,0,0.68)' }, svg)
      spot.classList.add('spotlight')
    },
    /** Brief attention flash on a mark after jumping to it. */
    pulse(rects: Rect[], point?: { x: number; y: number }) {
      const g = make('g', {}, svg)
      g.classList.add('pulse')
      for (const q of rects) make('rect', { x: q.x - 3, y: q.y - 2, width: q.w + 6, height: q.h + 4, rx: 5 }, g)
      if (!rects.length && point) make('circle', { cx: point.x, cy: point.y, r: PIN_R + 8 }, g)
      setTimeout(() => g.remove(), 1000)
    },
  }
}
