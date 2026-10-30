import { describe, expect, test } from 'vitest'
import { findImports, rewriteCss } from '../src/archive/css.ts'

const BASE = 'https://cdn.example/assets/css/site.css'

describe('rewriteCss', () => {
  test('relative, root-relative, quoted and unquoted addresses all become absolute, resolved against the stylesheet', () => {
    const { css, urls } = rewriteCss(`a{background:url(../img/a.png)} b{background:url("/b.png")} c{background:url('c.png')}`, BASE, () => null)
    expect(urls).toEqual(['https://cdn.example/assets/img/a.png', 'https://cdn.example/b.png', 'https://cdn.example/assets/css/c.png'])
    expect(css).toContain('url("https://cdn.example/assets/img/a.png")')
    expect(css).toContain('url("https://cdn.example/b.png")')
  })

  test('the map replaces an address with a saved-file token; unmapped ones stay absolute', () => {
    const { css } = rewriteCss('a{background:url(a.png)} b{background:url(b.png)}', BASE, (u) => (u.endsWith('a.png') ? 'pk-asset:' + 'a'.repeat(64) : null))
    expect(css).toContain(`url("pk-asset:${'a'.repeat(64)}")`)
    expect(css).toContain('url("https://cdn.example/assets/css/b.png")')
  })

  test('data:, saved-file tokens and #fragment references are left alone', () => {
    const src = `a{background:url(data:image/png;base64,AAAA)} b{background:url("pk-asset:${'b'.repeat(64)}")} c{filter:url(#blur)}`
    const { css, urls } = rewriteCss(src, BASE, () => 'nope')
    expect(css).toBe(src)
    expect(urls).toEqual([])
  })

  test('javascript:, file: and blob: addresses are dropped, never kept', () => {
    const { css, urls } = rewriteCss('a{background:url(javascript:alert(1))} b{background:url("file:///etc/passwd")} c{background:url(blob:https://x/1)}', BASE, () => null)
    expect(urls).toEqual([])
    expect(css).not.toMatch(/javascript|file:|blob:/)
    expect(css.match(/url\(""\)/g)).toHaveLength(3)
  })

  test('the same address is reported once', () => {
    expect(rewriteCss('a{background:url(x.png)} b{background:url(x.png)}', BASE, () => null).urls).toHaveLength(1)
  })

  test('@import in both spellings is understood and normalised', () => {
    const out = rewriteCss('@import "base.css"; @import url(other.css) screen; a{}', BASE, () => null)
    expect(out.urls).toEqual(['https://cdn.example/assets/css/base.css', 'https://cdn.example/assets/css/other.css'])
    expect(out.css).toContain('@import url("https://cdn.example/assets/css/base.css");')
  })
})

describe('findImports', () => {
  test('lists each import with the exact rule to replace and an absolute address', () => {
    const css = `@import url("a.css");\n@import '/b.css' print;\n@import "javascript:x";`
    expect(findImports(css, BASE).map((i) => i.url).sort()).toEqual(['https://cdn.example/assets/css/a.css', 'https://cdn.example/b.css'])
    expect(findImports(css, BASE).every((i) => css.includes(i.rule))).toBe(true)
  })
})
