import { clampScale, clientToDoc, zoomScroll, type Pt } from './coords.ts'

const SVG_NS = 'http://www.w3.org/2000/svg'

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
  const notify = () => listeners.forEach((cb) => cb())

  function applySize() {
    sizer.style.width = layoutWidth * scale + 'px'
    sizer.style.height = docHeight * scale + 'px'
    wrapper.style.width = layoutWidth + 'px'
    wrapper.style.height = docHeight + 'px'
    wrapper.style.transform = `scale(${scale})`
    iframe.style.height = docHeight + 'px'
    svg.setAttribute('width', String(layoutWidth))
    svg.setAttribute('height', String(docHeight))
    svg.setAttribute('viewBox', `0 0 ${layoutWidth} ${docHeight}`)
  }

  function measure() {
    const doc = iframe.contentDocument
    if (!doc) return
    iframe.style.height = '0px'
    docHeight = Math.max(doc.documentElement.scrollHeight, 1)
    applySize()
    notify()
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
      scale = clampScale(container.clientWidth / layoutWidth)
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
