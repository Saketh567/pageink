/**
 * Turns untrusted page HTML into an inert snapshot: no scripts, frames or forms; images are parked until near the
 * screen; lazy-image tricks are undone so pictures show without the site's JavaScript.
 */
import DOMPurify from 'dompurify'

export const SANITIZER_VERSION = 3

const LAZY: Array<[string, string]> = [['data-src', 'src'], ['data-lazy-src', 'src'], ['data-srcset', 'srcset']]
/** No scheme (a relative address), http(s), or an image data: URL. Anything else (javascript:, file:, blob:...) is never copied into src. */
const safeAddress = (v: string) => !/^\s*[a-z][a-z0-9+.-]*:/i.test(v) || /^\s*(https?:|data:image\/)/i.test(v)
/** A srcset is a list of addresses with sizes; every one of them has to be safe. */
const safeValue = (to: string, v: string) => (to === 'srcset' ? v.split(',').every((c) => safeAddress(c.trim().split(/\s+/)[0] ?? '')) : safeAddress(v))
/** More ways sites hide the real image until a script runs. Only images and sources take these. */
const LAZY_IMG: Array<[string, string]> = [
  ['data-original', 'src'], ['data-lazy', 'src'], ['data-original-src', 'src'], ['data-hi-res-src', 'src'], ['data-image', 'src'],
  ['data-lazy-srcset', 'srcset'], ['data-original-set', 'srcset'],
]
/** Background images loaded by script from one of these attributes. */
const LAZY_BG = ['data-bg', 'data-background-image', 'data-background']
const IMAGE_ADDRESS = /^(url\(|https?:|\/|\.\.?\/|data:image)/i
const FORBID_TAGS = ['script', 'iframe', 'frame', 'frameset', 'object', 'embed', 'form', 'base', 'portal', 'applet']
const FORBID_ATTR = ['srcdoc', 'ping', 'formaction']
const PAGE_CSP = "script-src 'none'; object-src 'none'; form-action 'none'"
/** A 1x1 transparent image: stands in for an image until it is near the screen, so there is no broken-image icon or alt text. */
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
const FREEZE_CSS = 'html,body{overflow:hidden!important}img[data-pk-src]{background:rgba(128,128,128,.14)}'

const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html')

const meta = (doc: Document, sel: string) => doc.querySelector<HTMLMetaElement>(sel)?.content.trim() ?? ''

/** Does the fetched HTML look like an empty JS app shell? Counts text outside script/style/noscript/template. */
export function inspectHtml(raw: string, baseUrl?: string): {
  title: string; textLength: number; emptyRoot: boolean; cover?: string; description?: string
} {
  const doc = parse(raw)
  let cover: string | undefined
  const img = meta(doc, 'meta[property="og:image"], meta[name="twitter:image"]')
  try { if (img) cover = new URL(img, baseUrl).href } catch { /* unresolvable cover is just skipped */ }
  if (cover && !/^https?:/i.test(cover)) cover = undefined
  const description = (meta(doc, 'meta[property="og:description"], meta[name="description"]') || undefined)?.slice(0, 300)
  const title = doc.title.trim() || doc.querySelector('h1')?.textContent?.trim() || ''
  const root = doc.querySelector('#root, #app, #__next, [data-reactroot]')
  const emptyRoot = !!root && !root.textContent?.trim() && !root.querySelector('img, svg, video, canvas')
  doc.querySelectorAll('script, style, noscript, template').forEach((n) => n.remove())
  return { title, textLength: (doc.body?.textContent ?? '').replace(/\s+/g, ' ').trim().length, emptyRoot, cover, description }
}

/**
 * Turn untrusted page HTML into an inert, frozen snapshot: no scripts, frames, forms or auto-navigation.
 * `baseUrl` (the final URL) lets relative images and styles keep loading from the original site.
 */
export function sanitize(raw: string, baseUrl?: string): string {
  const pre = parse(raw)
  // scripts never run in a snapshot, so the <noscript> fallbacks are the content we want
  pre.querySelectorAll('noscript').forEach((n) => n.replaceWith(...Array.from(n.childNodes)))

  const clean = DOMPurify.sanitize(pre.documentElement.outerHTML, {
    WHOLE_DOCUMENT: true,
    ADD_TAGS: ['link', 'style', 'meta'],
    FORBID_TAGS,
    FORBID_ATTR,
  })
  const doc = parse(clean)

  doc.querySelectorAll('meta[http-equiv]').forEach((n) => n.remove())
  doc.querySelectorAll('link').forEach((l) => {
    if (!/\b(stylesheet|icon)\b/i.test(l.getAttribute('rel') ?? '')) l.remove()
  })
  for (const [from, to] of LAZY) {
    doc.querySelectorAll(`img[${from}], source[${from}]`).forEach((el) => {
      const v = el.getAttribute(from)!
      if (safeValue(to, v)) el.setAttribute(to, v)
      el.removeAttribute(from)
    })
  }
  for (const [from, to] of LAZY_IMG) {
    doc.querySelectorAll(`img[${from}], source[${from}]`).forEach((el) => {
      const v = el.getAttribute(from)
      if (v && safeValue(to, v)) el.setAttribute(to, v)
      el.removeAttribute(from)
    })
  }
  for (const attr of LAZY_BG) {
    doc.querySelectorAll<HTMLElement>(`[${attr}]`).forEach((el) => {
      const v = el.getAttribute(attr)!.trim()
      if (!el.style.backgroundImage && IMAGE_ADDRESS.test(v)) el.style.backgroundImage = /^url\(/i.test(v) ? v : `url("${v.replace(/"/g, '%22')}")`
    })
  }
  // lazysizes-style sites show images only once a script swaps these classes
  doc.querySelectorAll('.lazyload, .lazyloading').forEach((el) => {
    el.classList.remove('lazyload', 'lazyloading')
    el.classList.add('lazyloaded')
  })
  doc.querySelectorAll('[loading]').forEach((el) => el.removeAttribute('loading'))
  // Park every image's address. The page is shown at full height, so the browser would fetch all of its images at
  // once (hundreds on a big site); the viewer restores each one when it is near the screen.
  doc.querySelectorAll('source[srcset]').forEach((src) => {
    src.setAttribute('data-pk-srcset', src.getAttribute('srcset')!)
    src.removeAttribute('srcset')
  })
  doc.querySelectorAll('img').forEach((img) => {
    img.setAttribute('decoding', 'async') // keeps scrolling smooth while pictures are drawn
    const src = img.getAttribute('src')
    const set = img.getAttribute('srcset')
    if (set) { img.setAttribute('data-pk-srcset', set); img.removeAttribute('srcset') }
    if (src && !src.startsWith('data:')) { img.setAttribute('data-pk-src', src); img.setAttribute('src', BLANK) }
    else if (!src && set) img.setAttribute('src', BLANK)
  })

  const head = doc.head
  const csp = doc.createElement('meta')
  csp.setAttribute('http-equiv', 'Content-Security-Policy')
  csp.setAttribute('content', PAGE_CSP)
  const freeze = doc.createElement('style')
  freeze.textContent = FREEZE_CSS
  head.prepend(csp)
  if (baseUrl) {
    const base = doc.createElement('base')
    base.setAttribute('href', baseUrl)
    head.prepend(base)
  }
  head.append(freeze)
  return '<!doctype html>' + doc.documentElement.outerHTML
}
