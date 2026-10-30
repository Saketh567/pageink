// @vitest-environment jsdom
import { describe, expect, test } from 'vitest'
import { elementPoint, resolve, selectorFor } from '../src/anchor/css-selector.ts'
import { anchorText, describe as describeText, offsetOf, textIndex, toRange } from '../src/anchor/text-quote.ts'
import { studySheet, type Mark } from '../src/export/study-sheet.ts'
import { blockBounds, sentenceBounds, startMark, wordBounds } from '../src/ink/mark.ts'
import type { Annotation } from '../src/store/schema.ts'

const doc = (body: string) => new DOMParser().parseFromString(`<!doctype html><body>${body}</body>`, 'text/html')

describe('text index and quote anchoring', () => {
  test('indexes visible text only, with correct offsets', () => {
    const d = doc('<p>Hello <b>big</b> world</p><script>var hidden = 1</script><style>p{}</style><p>Next</p>')
    const idx = textIndex(d)
    expect(idx.text).toBe('Hello big worldNext')
    const b = d.querySelector('b')!.firstChild!
    expect(offsetOf(idx, b, 1)).toBe(7)
  })

  test('round trip: describe then anchor then range gives the same words', () => {
    const d = doc('<p>Alpha. Hello brave new world. Omega.</p>')
    const idx = textIndex(d)
    const start = idx.text.indexOf('brave')
    const sel = describeText(idx, start, start + 'brave new'.length)
    const pos = anchorText(idx, sel)!
    expect(toRange(d, idx, pos.start, pos.end)!.toString()).toBe('brave new')
  })

  test('still finds the words after a paragraph is inserted above them', () => {
    const before = doc('<p>Intro text.</p><p>The quick brown fox jumps.</p>')
    const bi = textIndex(before)
    const s = bi.text.indexOf('brown fox')
    const sel = describeText(bi, s, s + 9)
    const after = doc('<p>A brand new paragraph that shifts everything down.</p><p>Intro text.</p><p>The quick brown fox jumps.</p>')
    const ai = textIndex(after)
    const pos = anchorText(ai, sel)!
    expect(pos.start).not.toBe(sel.position.start)
    expect(toRange(after, ai, pos.start, pos.end)!.toString()).toBe('brown fox')
  })

  test('returns null when the text has been deleted', () => {
    const before = doc('<p>Keep this. Remove this phrase please.</p>')
    const bi = textIndex(before)
    const s = bi.text.indexOf('Remove this phrase')
    const sel = describeText(bi, s, s + 18)
    expect(anchorText(textIndex(doc('<p>Keep this.</p>')), sel)).toBeNull()
  })

  test('duplicate sentences resolve to the right occurrence using the surrounding text', () => {
    const before = doc('<p>First: click here to begin.</p><p>Second: click here to finish.</p>')
    const bi = textIndex(before)
    const second = bi.text.lastIndexOf('click here')
    const sel = describeText(bi, second, second + 10)
    // a paragraph above moves everything, so the stored position no longer matches
    const after = doc('<p>Some new introduction text up here.</p><p>First: click here to begin.</p><p>Second: click here to finish.</p>')
    const ai = textIndex(after)
    const pos = anchorText(ai, sel)!
    expect(ai.text.slice(pos.start - 8, pos.start)).toBe('Second: ')
  })
})

describe('element selectors', () => {
  const html = '<main id="page"><header><h1>Title</h1></header><section><p>One</p><p>Two</p><ul><li>a</li><li>b</li></ul></section><div id="radix-:r1:"><span>x</span><span>y</span></div></main>'

  test('every element round-trips through selectorFor and resolve', () => {
    const d = doc(html)
    const all = Array.from(d.body.querySelectorAll('*'))
    expect(all.length).toBeGreaterThanOrEqual(12)
    for (const el of all) expect(resolve(selectorFor(el), d)).toBe(el)
  })

  test('uses a stable id but ignores generated ones', () => {
    const d = doc(html)
    expect(selectorFor(d.querySelector('main')!)).toBe('#page')
    expect(selectorFor(d.querySelectorAll('span')[1])).toBe('#page>div>span:nth-of-type(2)')
  })

  test('a selector that no longer matches resolves to null, not an error', () => {
    expect(resolve('body>nothing:nth-of-type(9)', doc('<p>x</p>'))).toBeNull()
    expect(resolve('((bad', doc('<p>x</p>'))).toBeNull()
    expect(elementPoint(doc('<p>x</p>'), { css: 'body>section', rx: 0, ry: 0 })).toBeNull()
  })
})

describe('growing a selection', () => {
  test('wordBounds snaps to whole words, including apostrophes', () => {
    const t = "hello don't brave world"
    expect(wordBounds(t, 8, 8)).toEqual([6, 11])
    expect(wordBounds(t, 14, 17)).toEqual([12, 17])
  })

  test('sentenceBounds picks the sentence around the selection', () => {
    const t = 'First sentence here. The second one is longer. A third ends it.'
    const s = t.indexOf('second')
    const [a, b] = sentenceBounds(t, 0, t.length, s, s + 6)
    expect(t.slice(a, b)).toBe('The second one is longer.')
  })

  test('a selection spanning two sentences covers both', () => {
    const t = 'One is short. Two is next. Three is last.'
    const [a, b] = sentenceBounds(t, 0, t.length, t.indexOf('short'), t.indexOf('Two') + 2)
    expect(t.slice(a, b)).toBe('One is short. Two is next.')
  })

  test('a sentence does not start with the footnote marker that follows the previous one', () => {
    const t = 'It ends here.[1] The term starts here. Another sentence.'
    const s = t.indexOf('starts')
    const [a, b] = sentenceBounds(t, 0, t.length, s, s + 6)
    expect(t.slice(a, b)).toBe('The term starts here.')
    const u = 'First one.[2][3] Second one.'
    const [c, d] = sentenceBounds(u, 0, u.length, u.indexOf('Second'), u.indexOf('Second') + 6)
    expect(u.slice(c, d)).toBe('Second one.')
  })

  test('blockBounds returns the paragraph text range', () => {
    const d = doc('<p>First para here.</p><p>Second <b>para</b> here.</p>')
    const idx = textIndex(d)
    const [s, e] = blockBounds(idx, idx.text.indexOf('para', 20))!
    expect(idx.text.slice(s, e)).toBe('Second para here.')
  })

  test('blockBounds at the very start of a paragraph picks that paragraph, not the heading before it', () => {
    const d = doc('<h2>The heading</h2><p>First para text.</p>')
    const idx = textIndex(d)
    const start = idx.text.indexOf('First')
    const [s, e] = blockBounds(idx, start)!
    expect(idx.text.slice(s, e)).toBe('First para text.')
  })

  test('a Mark session grows word to sentence to paragraph, then stops', () => {
    const d = doc('<p>Alpha opens it. Beta carries on. Gamma closes.</p>')
    const node = d.querySelector('p')!.firstChild as Text
    // jsdom has no layout: stand in for the browser's caret lookup, where x is the character offset
    ;(d as unknown as { caretRangeFromPoint: (x: number) => Range }).caretRangeFromPoint = (x) => {
      const r = d.createRange()
      r.setStart(node, x)
      return r
    }
    const idx = textIndex(d)
    const picked = () => idx.text.slice(s.result().start, s.result().end)
    const s = startMark(d, idx.text.indexOf('carries') + 2, 0)!
    expect(picked()).toBe('carries')
    expect(s.result().scope).toBe('words')

    expect(s.expand()).toBe('sentence')
    expect(picked()).toBe('Beta carries on.')
    expect(s.expand()).toBe('block')
    expect(picked()).toBe('Alpha opens it. Beta carries on. Gamma closes.')
    expect(s.expand()).toBeNull()

    s.update(idx.text.indexOf('Gamma') + 1, 0) // dragging resets to words and extends the selection
    expect(s.result().scope).toBe('words')
    expect(picked()).toBe('carries on. Gamma')
  })

  test('no selection starts when the point is not over text', () => {
    expect(startMark(doc('<p>text</p>'), 5, 5)).toBeNull()
  })
})

describe('studySheet', () => {
  const ann = (id: string, o: Partial<Annotation>): Annotation => ({
    id, pageId: 'p', kind: 'highlight', layer: 'highlights', color: '#ffd60a', anchor: { page: { x: 0, y: 0 } }, createdAt: '', updatedAt: '', ...o,
  })
  const hl = (id: string, exact: string, meaning: Annotation['meaning'], note?: string): Mark => ({
    a: ann(id, { meaning, anchor: { page: { x: 0, y: 0 }, text: { quote: { exact, prefix: '', suffix: '' }, position: { start: 0, end: 0 } } }, note: note ? { text: note } : undefined }),
    orphaned: false, y: 0,
  })
  const page = { title: 'My Page', url: 'https://site.example/a', capturedAt: '2026-10-29T12:00:00.000Z' }

  test('groups by meaning in a fixed order with quotes and notes', () => {
    const md = studySheet(page, [hl('1', 'An idea worth trying', 'idea'), hl('2', 'Key claim', 'important', 'Check the source'), hl('3', 'Why though?', 'question')])
    expect(md.startsWith('# My Page\nhttps://site.example/a · captured 2026-10-29 · 3 marks')).toBe(true)
    expect(md.indexOf('## Important')).toBeLessThan(md.indexOf('## Question'))
    expect(md.indexOf('## Question')).toBeLessThan(md.indexOf('## Idea'))
    expect(md).toContain('> Key claim\nCheck the source')
  })

  test('multi-line quotes stay inside the quote, loose notes and orphans get their own sections', () => {
    const note: Mark = { a: ann('n', { kind: 'note', layer: 'notes', note: { text: 'A loose thought' } }), orphaned: false, y: 0 }
    const lost = { ...hl('o', 'Gone text', 'important'), orphaned: true }
    const md = studySheet(page, [hl('1', 'line one\nline two', 'issue'), note, lost])
    expect(md).toContain('> line one line two')
    expect(md).toContain('## Other notes\n\nNote: A loose thought')
    expect(md).toContain('## Needs attention')
    expect(md.indexOf('Gone text')).toBeGreaterThan(md.indexOf('## Needs attention'))
  })

  test('a leading footnote marker saved with an older highlight is not shown in the sheet', () => {
    const md = studySheet(page, [hl('1', '1] The term typography is also applied', 'idea')])
    expect(md).toContain('> The term typography is also applied')
    expect(md).not.toContain('> 1]')
  })

  test('ink is left out and an empty page still produces a header', () => {
    const ink: Mark = { a: ann('i', { kind: 'ink' }), orphaned: false, y: 0 }
    expect(studySheet(page, [ink])).toBe('# My Page\nhttps://site.example/a · captured 2026-10-29 · 0 marks\n')
  })
})
