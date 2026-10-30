/**
 * Taps inside a saved page: open or close dropdowns and FAQs, scroll to anchors, and report links to other pages.
 */
import type { Viewer } from './viewer.ts'
import { toggleAt } from './widgets.ts'

export interface LinkTap { href: string; text: string }

/**
 * Taps inside the snapshot (any tap in Read mode, a finger tap in Mark mode): dropdowns and FAQ headers open and close, links are followed. The iframe never gets pointer events, so a short,
 * still tap on the container is hit-tested against the snapshot document instead.
 * Hash links scroll inside the page; everything else is reported to `onLink`.
 */
export function attachLinkTaps(viewer: Viewer, canTap: (e: PointerEvent) => boolean, onLink: (l: LinkTap) => void) {
  const c = viewer.container
  let down: { x: number; y: number; t: number } | null = null
  c.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: e.timeStamp } })
  c.addEventListener('pointerup', (e) => {
    const d = down
    down = null
    if (!d || !canTap(e) || (e.pointerType === 'mouse' && e.button !== 0)) return
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 10 || e.timeStamp - d.t > 500) return
    const doc = viewer.iframe.contentDocument
    if (!doc) return
    const p = viewer.clientToDoc(e.clientX, e.clientY)
    if (toggleAt(doc, p.x, p.y)) { viewer.remeasure(); return } // a dropdown or FAQ header: open or close it
    const a = doc.elementFromPoint(p.x, p.y)?.closest('a[href]')
    if (!a) return
    const raw = a.getAttribute('href') ?? ''
    if (raw.startsWith('#')) {
      const id = decodeURIComponent(raw.slice(1))
      const target = id ? doc.getElementById(id) ?? doc.getElementsByName(id)[0] : doc.body
      if (target) c.scrollTo({ top: target.getBoundingClientRect().top * viewer.scale, behavior: 'smooth' })
      return
    }
    const href = (a as HTMLAnchorElement).href
    if (/^https?:/i.test(href)) onLink({ href, text: a.textContent?.trim().slice(0, 80) ?? '' })
  })
}
