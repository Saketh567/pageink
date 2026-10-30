import { clampScale, clientToDoc, zoomScroll, type Pt } from './coords.ts'

const SVG_NS = 'http://www.w3.org/2000/svg'
const MEASURE_WINDOW = 900

export interface Viewer {
  container: HTMLElement
  svg: SVGSVGElement
  canvas: HTMLCanvasElement
  iframe: HTMLIFrameElement
  layoutWidth: number
  readonly docHeight: number
  readonly scale: number
  /** Top-left of the scaled document inside the scroll container (non-zero when centred). */
  contentOffset(): Pt
  clientToDoc(cx: number, cy: number): Pt
  docToClient(x: number, y: number): Pt
  /** Optional blank strip beside the page for handwriting in the margin. */
  readonly lane: boolean
  readonly laneWidth: number
  setLane(on: boolean): void
  /** Called whenever the page height is (re)measured: fonts and images arriving can move text. */
  onLayout(cb: () => void): void
  setScale(s: number, focusClient?: Pt): void
  fit(): void
  onViewChange(cb: () => void): void
  destroy(): void
}

/**
 * Stack, bottom to top: sandboxed iframe (frozen snapshot, no scripts), SVG overlay, live-stroke canvas.
 * The iframe never takes pointer events here; input is captured on the scroll container.
 */
export async function createViewer(host: HTMLElement, html: string, layoutWidth: number): Promise<Viewer> {
  host.replaceChildren()
  const root = el('div', 'viewer-root')
  const container = el('div', 'viewer-scroll')
  const sizer = el('div', 'viewer-sizer')
  const wrapper = el('div', 'viewer-wrapper')
  const iframe = document.createElement('iframe')
  iframe.setAttribute('sandbox', 'allow-same-origin')
  iframe.setAttribute('scrolling', 'no')
  iframe.className = 'viewer-frame'
  iframe.title = 'Page snapshot'
  iframe.style.width = layoutWidth + 'px'
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('class', 'viewer-ink')
  const canvas = el('canvas', 'viewer-live') as HTMLCanvasElement
  wrapper.append(iframe, svg)
  sizer.append(wrapper)
  container.append(sizer)
  root.append(container, canvas)
  host.append(root)

  let docHeight = 1000
  let scale = 1
  let fitMode = true
  const listeners: Array<() => void> = []
  const layoutListeners: Array<() => void> = []
  const LANE = 320
  let laneOn = false
  const totalWidth = () => layoutWidth + (laneOn ? LANE : 0)
  const laneEl = el('div', 'viewer-lane')
  laneEl.style.left = layoutWidth + 'px'
  laneEl.style.width = LANE + 'px'
  laneEl.hidden = true
  wrapper.prepend(laneEl)
  const notify = () => listeners.forEach((cb) => cb())

  function applySize() {
    sizer.style.width = totalWidth() * scale + 'px'
    sizer.style.height = docHeight * scale + 'px'
    wrapper.style.width = totalWidth() + 'px'
    wrapper.style.height = docHeight + 'px'
    wrapper.style.transform = `scale(${scale})`
    iframe.style.height = docHeight + 'px'
    svg.setAttribute('width', String(totalWidth()))
    svg.setAttribute('height', String(docHeight))
    svg.setAttribute('viewBox', `0 0 ${totalWidth()} ${docHeight}`)
    laneEl.style.height = docHeight + 'px'
  }

  function measure() {
    const doc = iframe.contentDocument
    if (!doc) return
    // Measure inside a normal-sized window: pages with html/body { height: 100% } collapse to nothing in a 0 px one.
    // scrollHeight still counts content that overflows (even with overflow hidden), so tall pages report their full height.
    iframe.style.height = MEASURE_WINDOW + 'px'
    // html reports only one window when body clips its overflow (Wikipedia); body.scrollHeight still has the real height
    let h = Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight)
    if (h <= MEASURE_WINDOW) {
      // short page (or one that only fills the window): use its lowest element, not the window size
      const bottoms = Array.from(doc.body.children, (e) => e.getBoundingClientRect().bottom)
      h = Math.max(300, Math.ceil(Math.max(0, ...bottoms)))
    }
    docHeight = h
    applySize()
    notify()
    layoutListeners.forEach((cb) => cb())
  }

  const loaded = new Promise<void>((resolve) => iframe.addEventListener('load', () => resolve(), { once: true }))
  iframe.srcdoc = html
  await loaded
  const doc = iframe.contentDocument
  if (doc) {
    const pending = [...doc.images].filter((i) => !i.complete)
    for (const img of pending) {
      img.addEventListener('load', measure, { once: true })
      img.addEventListener('error', measure, { once: true })
    }
  }
  measure()

  const viewer: Viewer = {
    container, svg, canvas, iframe, layoutWidth,
    get docHeight() { return docHeight },
    get scale() { return scale },
    contentOffset: () => ({ x: sizer.offsetLeft, y: sizer.offsetTop }),
    clientToDoc: (cx, cy) => clientToDoc(cx, cy, sizer.getBoundingClientRect(), scale),
    docToClient: (x, y) => { const r = sizer.getBoundingClientRect(); return { x: r.left + x * scale, y: r.top + y * scale } },
    get lane() { return laneOn },
    laneWidth: LANE,
    setLane(on) {
      laneOn = on
      laneEl.hidden = !on
      if (fitMode) viewer.fit(); else { applySize(); notify() }
    },
    onLayout: (cb) => void layoutListeners.push(cb),
    setScale(next, focusClient) {
      const rect = container.getBoundingClientRect()
      const fc = focusClient
        ? { x: focusClient.x - rect.left, y: focusClient.y - rect.top }
        : { x: container.clientWidth / 2, y: container.clientHeight / 2 }
      const off = sizer.offsetLeft
      const docPoint = { x: (container.scrollLeft + fc.x - off) / scale, y: (container.scrollTop + fc.y) / scale }
      scale = clampScale(next)
      fitMode = false
      applySize()
      const s = zoomScroll(docPoint, { x: fc.x - sizer.offsetLeft, y: fc.y }, scale)
      container.scrollLeft = s.scrollLeft
      container.scrollTop = s.scrollTop
      notify()
    },
    fit() {
      scale = clampScale(container.clientWidth / totalWidth())
      fitMode = true
      applySize()
      notify()
    },
    onViewChange: (cb) => void listeners.push(cb),
    destroy() {
      ro.disconnect()
      host.replaceChildren()
    },
  }

  container.addEventListener('scroll', notify, { passive: true })
  const ro = new ResizeObserver(() => (fitMode ? viewer.fit() : notify()))
  ro.observe(container)
  viewer.fit()
  return viewer
}

function el(tag: string, cls: string): HTMLElement {
  const e = document.createElement(tag)
  e.className = cls
  return e
}
