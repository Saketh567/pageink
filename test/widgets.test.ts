// @vitest-environment jsdom
import { describe, expect, test } from 'vitest'
import { revealAncestors, revealHidden, toggleAt } from '../src/viewer/widgets.ts'

// The page document of the test environment (it has a window, which computed styles need).
// jsdom has no layout, so the element a tap lands on is supplied directly.
function page(html: string) {
  document.body.innerHTML = html
  return document
}
function tap(el: Element | null) {
  document.elementFromPoint = () => el
  return toggleAt(document, 1, 1)
}
const $ = (id: string) => document.getElementById(id)!

describe('tapping dropdowns and FAQ headers', () => {
  test('a details summary opens and closes its block', () => {
    page('<details id="d"><summary id="s">Question</summary><p>Answer</p></details>')
    expect(tap($('s'))).toBe(true)
    expect(($('d') as HTMLDetailsElement).open).toBe(true)
    expect(tap($('s'))).toBe(true)
    expect(($('d') as HTMLDetailsElement).open).toBe(false)
  })

  test('an aria-expanded header shows and hides the panel it controls', () => {
    page('<button id="b" aria-expanded="false" aria-controls="p">Question</button><div id="p" hidden>The answer.</div>')
    expect(tap($('b'))).toBe(true)
    expect($('b').getAttribute('aria-expanded')).toBe('true')
    expect(($('p') as HTMLElement).hidden).toBe(false)
    expect($('p').style.getPropertyValue('display')).toBe('block')

    expect(tap($('b'))).toBe(true)
    expect($('b').getAttribute('aria-expanded')).toBe('false')
    expect($('p').style.getPropertyValue('display')).toBe('none')
  })

  test('a tap on something inside the header counts as a tap on the header', () => {
    page('<button id="b" aria-expanded="false" aria-controls="p"><span id="inner">Question</span></button><div id="p" hidden>x</div>')
    expect(tap($('inner'))).toBe(true)
    expect($('b').getAttribute('aria-expanded')).toBe('true')
  })

  test('FAQ markup with no aria at all: a button followed by a hidden answer', () => {
    page('<button id="b">Question</button><div id="a" style="display:none">Answer</div>')
    expect(tap($('b'))).toBe(true)
    expect($('a').style.getPropertyValue('display')).toBe('block')
    expect(tap($('b'))).toBe(true)
    expect($('a').style.getPropertyValue('display')).toBe('none')
  })

  test('a menu item that is a real link is left to navigate', () => {
    page('<a id="l" href="/pricing" aria-expanded="false">Pricing</a>')
    expect(tap($('l'))).toBe(false)
  })

  test('an in-page anchor header still toggles', () => {
    page('<a id="l" href="#faq" aria-expanded="false" aria-controls="p">Question</a><div id="p" hidden>x</div>')
    expect(tap($('l'))).toBe(true)
  })

  test('plain text and an empty spot do nothing', () => {
    page('<p id="t">Just text</p>')
    expect(tap($('t'))).toBe(false)
    expect(tap(null)).toBe(false)
  })
})

describe('revealHidden', () => {
  test('text that a site fades in on scroll becomes visible, but dialogs, banners and fixed overlays stay hidden', () => {
    page(`
      <div id="fade" style="opacity:0;transform:translateY(40px)"><p>This paragraph fades in once the page is scrolled.</p></div>
      <div id="dlg" role="dialog" style="opacity:0"><p>Sign up for our newsletter, a dialog.</p></div>
      <div id="cookie" class="cookie-banner" style="opacity:0"><p>We use cookies, a banner of some kind.</p></div>
      <div id="fixed" style="position:fixed;opacity:0"><p>A fixed overlay that is hidden on purpose.</p></div>
      <p id="visible">Already visible text in the page.</p>`)
    const n = revealHidden(document)
    expect(n).toBeGreaterThan(0)
    expect($('fade').style.getPropertyValue('opacity')).toBe('1')
    expect($('fade').style.getPropertyValue('transform')).toBe('none')
    expect($('dlg').style.getPropertyValue('opacity')).toBe('0')
    expect($('cookie').style.getPropertyValue('opacity')).toBe('0')
    expect($('fixed').style.getPropertyValue('opacity')).toBe('0')
    expect($('visible').style.getPropertyValue('opacity')).toBe('')
  })

  test('a hidden wrapper around visible-looking text is fixed from the text outwards', () => {
    page('<section id="outer" style="opacity:0"><div id="inner" style="opacity:0"><p>Deeply wrapped text that should show.</p></div></section>')
    revealHidden(document)
    expect($('outer').style.getPropertyValue('opacity')).toBe('1')
    expect($('inner').style.getPropertyValue('opacity')).toBe('1')
  })

  test('without expandAll, closed FAQ blocks stay closed; with it, they all open', () => {
    const html = '<details id="d"><summary>Q</summary>A</details><button id="b" aria-expanded="false" aria-controls="p">Q2</button><div id="p" hidden>A2 text.</div>'
    page(html)
    revealHidden(document)
    expect(($('d') as HTMLDetailsElement).open).toBe(false)
    expect(($('p') as HTMLElement).hidden).toBe(true)

    expect(revealHidden(document, { expandAll: true })).toBeGreaterThanOrEqual(2)
    expect(($('d') as HTMLDetailsElement).open).toBe(true)
    expect(($('p') as HTMLElement).hidden).toBe(false)
    expect($('b').getAttribute('aria-expanded')).toBe('true')
  })

  test('a page with nothing hidden reports nothing changed', () => {
    page('<p>Plain readable text on the page.</p>')
    expect(revealHidden(document, { expandAll: true })).toBe(0)
  })
})

test('revealAncestors opens the sections that hide a node', () => {
  page('<details id="d"><div id="x" hidden><p id="t">Hidden deep inside</p></div></details>')
  expect(revealAncestors($('t').firstChild!)).toBe(true)
  expect(($('d') as HTMLDetailsElement).open).toBe(true)
  expect(($('x') as HTMLElement).hidden).toBe(false)
  expect(revealAncestors($('t').firstChild!)).toBe(false) // nothing left to open
})
