// @vitest-environment jsdom
import { describe, expect, test } from 'vitest'
import { inspectHtml, sanitize } from '../src/import/sanitize.ts'

const BASE = 'https://example.com/page'

/** Anything in the output that could run code, navigate, or submit data. */
function vectors(html: string): string[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const found: string[] = []
  doc.querySelectorAll('script, iframe, frame, object, embed, form, portal, applet').forEach((n) => found.push(n.tagName))
  doc.querySelectorAll('base').forEach((b) => b.getAttribute('href') !== BASE && found.push('base'))
  doc.querySelectorAll('meta[http-equiv]').forEach((m) => {
    if (!/content-security-policy/i.test(m.getAttribute('http-equiv')!)) found.push('meta ' + m.getAttribute('http-equiv'))
  })
  doc.querySelectorAll('*').forEach((el) => {
    for (const a of Array.from(el.attributes)) {
      if (/^on/i.test(a.name)) found.push(`${el.tagName}@${a.name}`)
      if (['srcdoc', 'formaction', 'ping'].includes(a.name)) found.push(`${el.tagName}@${a.name}`)
      if (/^(href|src|xlink:href|action|data|poster)$/i.test(a.name) && /^[\s\u0000-\u001f]*(javascript|vbscript|data:text\/html)/i.test(a.value.replace(/[\t\n\r]/g, ''))) {
        found.push(`${el.tagName}@${a.name}=${a.value}`)
      }
    }
  })
  doc.querySelectorAll('link').forEach((l) => !/\b(stylesheet|icon)\b/i.test(l.getAttribute('rel') ?? '') && found.push('link'))
  return found
}

const FIXTURES: Record<string, string> = {
  script: '<p>a</p><script>alert(1)</script>',
  imgOnerror: '<img src=x onerror=alert(1)>',
  svgScript: '<svg><script>alert(1)</script></svg>',
  svgAnimate: '<svg><a><animate attributeName=href values="javascript:alert(1)" /><text>x</text></a></svg>',
  svgOnload: '<svg onload=alert(1)></svg>',
  jsHrefMixedCase: '<a href="JaVaScRiPt:alert(1)">x</a>',
  jsHrefTab: '<a href=" java\tscript:alert(1)">x</a>',
  iframeSrcdoc: '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
  iframeSrc: '<iframe src="https://evil.example"></iframe>',
  metaRefresh: '<meta http-equiv="refresh" content="0;url=https://evil.example"><p>x</p>',
  formAction: '<form action="https://evil.example"><input name=a><button formaction="https://evil.example">go</button></form>',
  object: '<object data="javascript:alert(1)"></object>',
  embed: '<embed src="javascript:alert(1)">',
  baseTag: '<base href="https://evil.example/"><a href="/x">x</a>',
  mxssMath: '<math><mtext><table><mglyph><style><!--</style><img title="--&gt;&lt;img src=1 onerror=alert(1)&gt;">',
  linkImport: '<link rel="import" href="https://evil.example/x.html"><link rel="preload" href="/x.js" as="script">',
  styleImport: '<style>@import url("https://evil.example/x.css");p{color:red}</style><p>x</p>',
  bodyOnload: '<body onload=alert(1)><p>x</p></body>',
  inputAutofocus: '<input autofocus onfocus=alert(1)>',
  videoPoster: '<video poster="javascript:alert(1)" onerror=alert(1)><source src=x onerror=alert(1)></video>',
}

describe('sanitize: XSS fixtures leave no executable vector', () => {
  test.each(Object.entries(FIXTURES))('%s', (_n, html) => {
    expect(vectors(sanitize(`<!doctype html><html><head><title>t</title></head><body>${html}</body></html>`, BASE))).toEqual([])
  })
})

describe('detector control', () => {
  test('flags most fixtures when they are NOT sanitized', () => {
    const hits = Object.values(FIXTURES).filter((h) => vectors(`<!doctype html><html><head></head><body>${h}</body></html>`).length > 0)
    expect(hits.length).toBeGreaterThanOrEqual(15)
  })
})

describe('sanitize: content handling', () => {
  test('keeps readable content and styles', () => {
    const out = sanitize('<html><head><title>Hi</title><style>p{color:red}</style></head><body><h1>Title</h1><p>Body</p></body></html>', BASE)
    expect(out).toContain('<h1>Title</h1>')
    expect(out).toContain('p{color:red}')
    expect(out.startsWith('<!doctype html>')).toBe(true)
  })

  test('lazy attributes are promoted, loading=lazy dropped, and every image address is parked for the viewer', () => {
    const out = sanitize('<body><img data-src="/a.png" loading="lazy"><img data-lazy-src="/b.png"><picture><source data-srcset="/c.png 1x"><img src="/d.png" srcset="/d2.png 2x"></picture></body>', BASE)
    const doc = new DOMParser().parseFromString(out, 'text/html')
    const imgs = doc.querySelectorAll('img')
    expect(imgs[0].getAttribute('data-pk-src')).toBe('/a.png')
    expect(imgs[1].getAttribute('data-pk-src')).toBe('/b.png')
    expect(doc.querySelector('source')!.getAttribute('data-pk-srcset')).toBe('/c.png 1x')
    expect(imgs[2].getAttribute('data-pk-src')).toBe('/d.png')
    expect(imgs[2].getAttribute('data-pk-srcset')).toBe('/d2.png 2x')
    expect(doc.querySelector('[loading]')).toBeNull()
    for (const img of imgs) {
      expect(img.getAttribute('src')).toMatch(/^data:image\/gif/) // nothing is fetched until the viewer wakes it
      expect(img.hasAttribute('srcset')).toBe(false)
    }
    expect(doc.querySelector('source')!.hasAttribute('srcset')).toBe(false)
  })

  test('inline data: images are left alone', () => {
    const out = sanitize('<body><img src="data:image/png;base64,iVBORw0KGgo="></body>', BASE)
    const img = new DOMParser().parseFromString(out, 'text/html').querySelector('img')!
    expect(img.getAttribute('src')).toBe('data:image/png;base64,iVBORw0KGgo=')
    expect(img.hasAttribute('data-pk-src')).toBe(false)
  })

  test('unwraps noscript fallbacks', () => {
    const out = sanitize('<body><noscript><p id="fallback">Static text</p></noscript></body>', BASE)
    expect(out).toContain('id="fallback"')
    expect(out).not.toContain('<noscript')
  })

  test('adds base first in head, a script-blocking CSP and the freeze style', () => {
    const doc = new DOMParser().parseFromString(sanitize('<body>x</body>', BASE), 'text/html')
    expect(doc.head.firstElementChild!.tagName).toBe('BASE')
    expect(doc.querySelector('meta[http-equiv="Content-Security-Policy"]')!.getAttribute('content')).toContain("script-src 'none'")
    expect(doc.head.innerHTML).toContain('overflow:hidden')
  })

  test('keeps stylesheet and icon links only', () => {
    const doc = new DOMParser().parseFromString(sanitize('<head><link rel="stylesheet" href="/a.css"><link rel="icon" href="/f.ico"><link rel="prefetch" href="/n"></head>', BASE), 'text/html')
    expect(Array.from(doc.querySelectorAll('link')).map((l) => l.getAttribute('rel'))).toEqual(['stylesheet', 'icon'])
  })
})

describe('inspectHtml', () => {
  test('flags an empty SPA root and ignores script text', () => {
    const r = inspectHtml('<html><head><title>App</title></head><body><div id="root"></div><script>var x = "lots of script text lots of script text"</script></body></html>')
    expect(r).toEqual({ title: 'App', textLength: 0, emptyRoot: true })
  })

  test('counts real text, not noscript, and finds the title from h1', () => {
    const r = inspectHtml('<body><noscript>Please enable JavaScript</noscript><h1>Hello</h1><p>World</p></body>')
    expect(r.textLength).toBe('HelloWorld'.length)
    expect(r.title).toBe('Hello')
    expect(r.emptyRoot).toBe(false)
  })
})
