/**
 * Dropdowns, FAQs and tabs normally open with the site's own JavaScript, which a saved copy cannot run (scripts are
 * blocked on purpose: they would make an imported page unsafe). Their content is usually still in the page, only hidden.
 * These helpers show and hide it directly, so a copy of a page is as readable as the original.
 */

const FORCE_SHOWN: Array<[string, string]> = [
  ['display', 'block'], ['visibility', 'visible'], ['opacity', '1'], ['max-height', 'none'],
  ['height', 'auto'], ['overflow', 'visible'], ['transform', 'none'],
]
/** Things that are meant to stay out of sight until something happens: never force these open on their own. */
const KEEP_HIDDEN = '[aria-hidden="true"], dialog, [role="dialog"], [role="alertdialog"], [role="tooltip"], [role="alert"], [role="status"], [role="menu"], .modal, .tooltip, .popover, [class*="cookie"], [id*="cookie"], [class*="consent"]'

const win = (el: Element) => el.ownerDocument.defaultView!

function isHidden(el: Element): boolean {
  const s = win(el).getComputedStyle(el)
  return !!(el as HTMLElement).hidden || s.display === 'none' || s.visibility === 'hidden' || s.maxHeight === '0px' || (parseFloat(s.height) === 0 && s.overflow !== 'visible')
}

export function showPanel(el: HTMLElement) {
  el.hidden = false
  el.removeAttribute('aria-hidden')
  el.dataset.pkShown = '1'
  for (const [k, v] of FORCE_SHOWN) el.style.setProperty(k, v, 'important')
}

export function hidePanel(el: HTMLElement) {
  delete el.dataset.pkShown
  for (const [k] of FORCE_SHOWN) el.style.removeProperty(k)
  el.style.setProperty('display', 'none', 'important')
}

/** The panel a header controls: what it points at with aria-controls, or else the block right after it if that is hidden. */
function panelsOf(ctl: Element): HTMLElement[] {
  const ids = (ctl.getAttribute('aria-controls') ?? '').split(/\s+/).filter(Boolean)
  const byId = ids.map((id) => ctl.ownerDocument.getElementById(id)).filter((e): e is HTMLElement => !!e)
  if (byId.length) return byId
  const next = ctl.nextElementSibling as HTMLElement | null
  return next && (isHidden(next) || next.dataset.pkShown) ? [next] : []
}

function setExpanded(ctl: Element, open: boolean): boolean {
  const panels = panelsOf(ctl)
  ctl.setAttribute('aria-expanded', String(open))
  for (const p of panels) (open ? showPanel : hidePanel)(p)
  return true
}

/** True when a tap at (x, y) was a dropdown, FAQ header or details summary and it has been opened or closed. */
export function toggleAt(doc: Document, x: number, y: number): boolean {
  const el = doc.elementFromPoint(x, y)
  if (!el) return false

  const summary = el.closest('summary')
  const details = summary?.parentElement
  if (details?.tagName === 'DETAILS') {
    details.toggleAttribute('open')
    return true
  }

  const ctl = el.closest('[aria-expanded]')
  if (ctl) {
    const href = ctl.getAttribute('href')
    if (href && !href.startsWith('#')) return false // a real link that happens to be a menu item: let it navigate
    return setExpanded(ctl, ctl.getAttribute('aria-expanded') !== 'true')
  }

  // FAQ markup with no aria at all: a button followed by a hidden answer
  const button = el.closest('button, [role="button"]')
  if (button) {
    const next = button.nextElementSibling as HTMLElement | null
    if (next && (isHidden(next) || next.dataset.pkShown)) {
      if (next.dataset.pkShown) hidePanel(next)
      else showPanel(next)
      return true
    }
  }
  return false
}

/** Does this element have text of its own (not just inside children)? Only those are worth checking. */
const ownText = (el: Element) => Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.nodeValue ?? '').trim().length > 2)

/**
 * Makes content visible that a saved copy would otherwise leave blank. Always: text that sites fade in on scroll
 * (opacity 0 until their script runs). On request (`expandAll`): also every closed details block and every dropdown
 * or FAQ panel. Returns how many things it changed.
 */
export function revealHidden(doc: Document, opts: { expandAll?: boolean } = {}): number {
  let changed = 0
  const hasLayout = doc.body.getClientRects().length > 0 // false in test environments without layout

  for (const el of Array.from(doc.body.querySelectorAll('*'))) {
    if (!ownText(el) || el.closest(KEEP_HIDDEN)) continue
    const w = win(el)
    if (hasLayout && el.getClientRects().length === 0) continue // not drawn at all (display none somewhere above)
    const s = w.getComputedStyle(el)
    // fixed overlays (banners, chat widgets) are hidden on purpose; so is anything inside one
    let fixed = false
    for (let a: Element | null = el; a && a !== doc.body; a = a.parentElement) {
      if (w.getComputedStyle(a).position === 'fixed') { fixed = true; break }
    }
    if (fixed) continue
    if (s.visibility === 'hidden') { (el as HTMLElement).style.setProperty('visibility', 'visible', 'important'); changed++ }
    for (let a: Element | null = el; a && a !== doc.body; a = a.parentElement) {
      if (a.matches(KEEP_HIDDEN)) break
      if (w.getComputedStyle(a).opacity === '0') {
        ;(a as HTMLElement).style.setProperty('opacity', '1', 'important')
        ;(a as HTMLElement).style.setProperty('transform', 'none', 'important')
        changed++
      }
    }
  }

  if (opts.expandAll) {
    doc.querySelectorAll('details:not([open])').forEach((d) => { d.setAttribute('open', ''); changed++ })
    doc.querySelectorAll('[aria-expanded="false"][aria-controls]').forEach((ctl) => {
      if (!ctl.getAttribute('href')?.startsWith('http')) { setExpanded(ctl, true); changed++ }
    })
  }
  return changed
}

/** Opens whatever hides this node (a closed details block, a collapsed panel) so a mark placed inside it can be shown. */
export function revealAncestors(node: Node): boolean {
  let changed = false
  for (let e = node.parentElement; e && e !== e.ownerDocument.body && e !== e.ownerDocument.documentElement; e = e.parentElement) {
    if (e.tagName === 'DETAILS' && !(e as HTMLDetailsElement).open) { e.setAttribute('open', ''); changed = true }
    else if (isHidden(e)) { showPanel(e as HTMLElement); changed = true }
  }
  return changed
}
