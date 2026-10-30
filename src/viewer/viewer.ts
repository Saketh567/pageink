/**
 * Shows a saved page: a sandboxed iframe, the ink layer and a live canvas, laid out at the screen width, re-laid
 * out on rotation, with images loaded as they come near.
 */
import { clampScale, clientToDoc, zoomScroll, type Pt } from './coords.ts'

const SVG_NS = 'http://www.w3.org/2000/svg'
const MEASURE_WINDOW = 900
const MIN_AUTO = 320
const MAX_AUTO = 1600
const LANE = 320

export interface Viewer {
  container: HTMLElement
  svg: SVGSVGElement
  canvas: HTMLCanvasElement
  iframe: HTMLIFrameElement
  /** The width the page is laid out at right now (in Auto mode it follows the screen). */
  readonly layoutWidth: number
  /** True when the page lays itself out at the width of your screen, like the original site would. */
  readonly auto: boolean
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
  /** Lay the page out again now (after something was opened or closed in it). */
  remeasure(): void
  /** Something inside the page moved (a carousel scrolled): marks sitting on it have to be found again. */
  follow(): void
  /** Called whenever the page is laid out again: a new width, late fonts or images can all move text. */
  onLayout(cb: () => void): void
  setScale(s: number, focusClient?: Pt): void
  fit(): void
  onViewChange(cb: () => void): void
  destroy(): void
}

/**
 * Stack, bottom to top: sandboxed iframe (the page snapshot, no scripts), SVG overlay, live-stroke canvas.
 * The iframe never takes pointer events here; input is captured on the scroll container.
 *
 * `requestedWidth` 0 means Auto: the page is laid out at the width of the screen, so a site shows the layout
 * it would show in Safari (an iPad gets the tablet design, not a shrunken desktop one), and it is laid out again
 * when the screen rotates or resizes. A number fixes the layout at that width and scales it to fit.
 */
export async function createViewer(host: HTMLElement, html: string, requestedWidth: number): Promise<Viewer> {
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
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('class', 'viewer-ink')
  const canvas = el('canvas', 'viewer-live') as HTMLCanvasElement
  wrapper.append(iframe, svg)
  sizer.append(wrapper)
  container.append(sizer)
  root.append(container, canvas)
  host.append(root)

  const auto = requestedWidth === 0
  let laneOn = false
  const autoWidth = () => Math.min(MAX_AUTO, Math.max(MIN_AUTO, Math.floor(container.clientWidth - (laneOn ? LANE : 0))))
  let layoutWidth = auto ? autoWidth() : requestedWidth
  let docHeight = 1000
  let scale = 1
  let fitMode = true
  const listeners: Array<() => void> = []
  const layoutListeners: Array<() => void> = []
  const totalWidth = () => layoutWidth + (laneOn ? LANE : 0)
  const laneEl = el('div', 'viewer-lane')
  laneEl.style.width = LANE + 'px'
  laneEl.hidden = true
  wrapper.prepend(laneEl)
  iframe.style.width = layoutWidth + 'px'
  laneEl.style.left = layoutWidth + 'px'

  // ---- images: only those near the screen are fetched (see sanitize.ts, which parks every image's address)
  let lazy: HTMLImageElement[] = []
  let wakeQueued = false
  function activate(img: HTMLImageElement) {
    const pic = img.parentElement?.tagName === 'PICTURE' ? img.parentElement : null
    pic?.querySelectorAll<HTMLSourceElement>('source[data-pk-srcset]').forEach((s) => {
      s.srcset = s.dataset.pkSrcset!
      s.removeAttribute('data-pk-srcset')
    })
    const { pkSrc, pkSrcset } = img.dataset
    img.addEventListener('load', scheduleMeasure, { once: true })
    img.addEventListener('error', scheduleMeasure, { once: true })
    if (pkSrcset) { img.srcset = pkSrcset; img.removeAttribute('data-pk-srcset') }
    if (pkSrc) { img.src = pkSrc; img.removeAttribute('data-pk-src') }
  }
  function wake() {
    wakeQueued = false
    if (!lazy.length) return
    const top = container.scrollTop / scale
    const span = container.clientHeight / scale
    const from = top - span
    const to = top + span * 2.5
    const mid = top + span / 2
    const due: Array<[number, HTMLImageElement]> = []
    lazy = lazy.filter((img) => {
      const r = img.getBoundingClientRect() // the iframe is never scrolled, so these are document coordinates
      if (r.bottom < from || r.top > to) return true
      due.push([Math.abs((r.top + r.bottom) / 2 - mid), img])
      return false
    })
    due.sort((a, b) => a[0] - b[0]).forEach(([, img]) => activate(img)) // the picture closest to where you are reading goes first
  }
  const queueWake = () => {
    if (wakeQueued) return
    wakeQueued = true
    requestAnimationFrame(wake)
  }
  const notify = () => {
    listeners.forEach((cb) => cb())
    queueWake()
  }

  function applySize() {
    sizer.style.width = totalWidth() * scale + 'px'
    sizer.style.height = docHeight * scale + 'px'
    wrapper.style.width = totalWidth() + 'px'
    wrapper.style.height = docHeight + 'px'
    wrapper.style.transform = `scale(${scale})`
    iframe.style.width = layoutWidth + 'px'
    iframe.style.height = docHeight + 'px'
    svg.setAttribute('width', String(totalWidth()))
    svg.setAttribute('height', String(docHeight))
    svg.setAttribute('viewBox', `0 0 ${totalWidth()} ${docHeight}`)
    laneEl.style.left = layoutWidth + 'px'
    laneEl.style.height = docHeight + 'px'
  }

  /**
   * Runs a change that can move content (a new width, an image arriving) and then scrolls so the text you were
   * reading stays where it was on screen, instead of the page lurching under your finger.
   */
  function keepPlace(change: () => void) {
    const doc = iframe.contentDocument
    const top = container.scrollTop / scale
    let anchor: Element | null = null
    let offset = 0
    if (doc && top > 40) {
      for (const f of [0.5, 0.35, 0.65, 0.2, 0.8]) {
        const e = doc.elementFromPoint(layoutWidth * f, top + 8)
        if (e && e !== doc.body && e !== doc.documentElement && e.getBoundingClientRect().height < 800) { anchor = e; break }
      }
      if (anchor) offset = anchor.getBoundingClientRect().top - top
    }
    change()
    if (anchor?.isConnected) {
      const want = Math.max(0, (anchor.getBoundingClientRect().top - offset) * scale)
      if (Math.abs(want - container.scrollTop) >= 2) container.scrollTop = want // leave momentum scrolling alone when nothing moved
    }
  }

  let settled = false
  let followQueued = false
  function measure() {
    const doc = iframe.contentDocument
    if (!doc) return
    const run = () => {
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
    }
    if (settled) keepPlace(run)
    else run()
    settled = true
    notify()
    layoutListeners.forEach((cb) => cb())
  }
  let measureTimer: ReturnType<typeof setTimeout> | undefined
  function scheduleMeasure() {
    clearTimeout(measureTimer)
    measureTimer = setTimeout(measure, 120) // a burst of images arriving causes one re-measure, not dozens
  }

  const loaded = new Promise<void>((resolve) => iframe.addEventListener('load', () => resolve(), { once: true }))
  iframe.srcdoc = html
  await loaded
  const doc = iframe.contentDocument
  if (doc) {
    lazy = Array.from(doc.querySelectorAll<HTMLImageElement>('img[data-pk-src], img[data-pk-srcset]'))
    doc.fonts?.ready.then(scheduleMeasure) // web fonts change line breaks and so heights
    // a carousel or table inside the page scrolled: marks sitting on it have to follow
    doc.addEventListener('scroll', () => viewer.follow(), { capture: true, passive: true })
  }
  measure()

  /** In Auto mode the page is laid out again whenever the screen width changes (rotation, Split View, window resize). */
  function relayout() {
    if (!auto || !fitMode) return
    const w = autoWidth()
    if (w === layoutWidth) { viewer.fit(); return }
    keepPlace(() => {
      layoutWidth = w
      iframe.style.width = w + 'px'
      measure()
    })
    viewer.fit()
  }

  const viewer: Viewer = {
    container, svg, canvas, iframe, auto,
    get layoutWidth() { return layoutWidth },
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
      if (auto && fitMode) relayout() // the page gets narrower to make room for the margin, so the scale stays natural
      else if (fitMode) viewer.fit()
      else { applySize(); notify() }
    },
    remeasure: () => measure(),
    follow() {
      if (followQueued) return
      followQueued = true
      requestAnimationFrame(() => { followQueued = false; layoutListeners.forEach((cb) => cb()) })
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
      const s = container.clientWidth / totalWidth()
      scale = clampScale(Math.abs(s - 1) < 0.01 ? 1 : s) // an Auto page is laid out at the screen width, so it is shown at true size
      fitMode = true
      applySize()
      notify()
    },
    onViewChange: (cb) => void listeners.push(cb),
    destroy() {
      ro.disconnect()
      clearTimeout(resizeTimer)
      clearTimeout(measureTimer)
      host.replaceChildren()
    },
  }

  container.addEventListener('scroll', notify, { passive: true })
  let resizeTimer: ReturnType<typeof setTimeout> | undefined
  const ro = new ResizeObserver(() => {
    if (!auto) { if (fitMode) viewer.fit(); else notify(); return }
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(relayout, 160) // dragging a Split View divider fires many sizes; lay out once it settles
  })
  ro.observe(container)
  viewer.fit()
  queueWake()
  return viewer
}

function el(tag: string, cls: string): HTMLElement {
  const e = document.createElement(tag)
  e.className = cls
  return e
}
