import DOMPurify from 'dompurify'

export const SANITIZER_VERSION = 1

const LAZY: Array<[string, string]> = [['data-src', 'src'], ['data-lazy-src', 'src'], ['data-srcset', 'srcset']]
const FORBID_TAGS = ['script', 'iframe', 'frame', 'frameset', 'object', 'embed', 'form', 'base', 'portal', 'applet']
const FORBID_ATTR = ['srcdoc', 'ping', 'formaction']
const PAGE_CSP = "script-src 'none'; object-src 'none'; form-action 'none'"
const FREEZE_CSS = 'html,body{overflow:hidden!important}'

const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html')

/** Does the fetched HTML look like an empty JS app shell? Counts text outside script/style/noscript/template. */
export function inspectHtml(raw: string): { title: string; textLength: number; emptyRoot: boolean } {
  const doc = parse(raw)
  const title = doc.title.trim() || doc.querySelector('h1')?.textContent?.trim() || ''
  const root = doc.querySelector('#root, #app, #__next, [data-reactroot]')
  const emptyRoot = !!root && !root.textContent?.trim() && !root.querySelector('img, svg, video, canvas')
  doc.querySelectorAll('script, style, noscript, template').forEach((n) => n.remove())
  return { title, textLength: (doc.body?.textContent ?? '').replace(/\s+/g, ' ').trim().length, emptyRoot }
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
    doc.querySelectorAll(`[${from}]`).forEach((el) => {
      el.setAttribute(to, el.getAttribute(from)!)
      el.removeAttribute(from)
    })
  }
  doc.querySelectorAll('[loading]').forEach((el) => el.removeAttribute('loading'))

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
