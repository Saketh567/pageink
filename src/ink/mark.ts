/**
 * Text selection rules for the Mark tool: grow to whole words, then the sentence, then the paragraph; find the
 * text under a point.
 */
import { offsetOf, rectsOf, textIndex, toRange, type TextIndex } from '../anchor/text-quote.ts'

const BLOCK = 'p,li,blockquote,h1,h2,h3,h4,h5,h6,td,th,dd,dt,figcaption,pre'
const isWord = (c: string | undefined) => !!c && /[\p{L}\p{N}'’_-]/u.test(c)

/** Grow [s, e) outwards to whole words. A caret in the middle of a word selects that word. */
export function wordBounds(text: string, s: number, e: number): [number, number] {
  while (s > 0 && isWord(text[s - 1])) s--
  while (e < text.length && isWord(text[e])) e++
  return [s, e]
}

/** The smallest run of whole sentences inside [blockStart, blockEnd) that covers [s, e). */
export function sentenceBounds(text: string, blockStart: number, blockEnd: number, s: number, e: number): [number, number] {
  if (typeof Intl === 'undefined' || typeof Intl.Segmenter === 'undefined') return [blockStart, blockEnd]
  let lo = blockEnd
  let hi = blockStart
  for (const seg of new Intl.Segmenter(undefined, { granularity: 'sentence' }).segment(text.slice(blockStart, blockEnd))) {
    const a = blockStart + seg.index
    const b = a + seg.segment.length
    if (b > s && a < Math.max(e, s + 1)) { lo = Math.min(lo, a); hi = Math.max(hi, b) }
  }
  if (lo >= hi) return [s, e]
  // Skip leading whitespace and footnote markers ("[1]", "[2][3]") that belong to the previous sentence. The sentence
  // splitter leaves the markers' opening bracket behind, so a marker can also arrive as just "1]".
  for (let m: RegExpExecArray | null; lo < hi && (m = /^(\s+|(?:\[?\w{1,4}\])+)/.exec(text.slice(lo, hi))); ) lo += m[0].length
  while (hi > lo && /\s/.test(text[hi - 1])) hi--
  return [lo, hi]
}

/** The text of the paragraph, list item, heading or cell that holds this offset. */
export function blockBounds(index: TextIndex, offset: number): [number, number] | null {
  // a position on the boundary belongs to the text that starts there, not the text that ends there
  const hit = index.nodes.find((x) => offset >= x.start && offset < x.end) ?? index.nodes.find((x) => offset === x.end)
  const block = hit?.node.parentElement?.closest(BLOCK)
  if (!block) return null
  const inside = index.nodes.filter((x) => block.contains(x.node))
  return inside.length ? [inside[0].start, inside[inside.length - 1].end] : null
}

type CaretDoc = Document & {
  caretRangeFromPoint?(x: number, y: number): Range | null
  caretPositionFromPoint?(x: number, y: number): { offsetNode: Node; offset: number } | null
}

/** Text offset of the caret under a document point, or null when the point is not over text. */
export function caretOffset(doc: Document, x: number, y: number): number | null {
  const d = doc as CaretDoc
  let node: Node | undefined
  let off = 0
  const r = d.caretRangeFromPoint?.(x, y)
  if (r) { node = r.startContainer; off = r.startOffset } else {
    const p = d.caretPositionFromPoint?.(x, y)
    if (p) { node = p.offsetNode; off = p.offset }
  }
  return node ? offsetOf(textIndex(doc), node, off) : null
}

type Scope = 'words' | 'sentence' | 'block'

export interface MarkSession {
  /** Drag: move the free end of the selection. */
  update(x: number, y: number): void
  /** Hold still: grow words to sentence, then sentence to paragraph. Returns the new scope, or null at the limit. */
  expand(): Scope | null
  result(): { start: number; end: number; scope: Scope }
  rects(): Array<{ x: number; y: number; w: number; h: number }>
}

export function startMark(doc: Document, x: number, y: number): MarkSession | null {
  const anchor = caretOffset(doc, x, y)
  if (anchor === null) return null
  const idx = textIndex(doc)
  let free = anchor
  let scope: Scope = 'words'
  let fixed: [number, number] | null = null

  const bounds = (): [number, number] => fixed ?? wordBounds(idx.text, Math.min(anchor, free), Math.max(anchor, free))
  const session: MarkSession = {
    update(px, py) {
      const o = caretOffset(doc, px, py)
      if (o === null) return
      free = o
      fixed = null
      scope = 'words'
    },
    expand() {
      const [s, e] = bounds()
      if (scope === 'words') {
        const block = blockBounds(idx, s)
        if (block) {
          const [ns, ne] = sentenceBounds(idx.text, block[0], block[1], s, e)
          if (ns < s || ne > e) { fixed = [ns, ne]; scope = 'sentence'; return scope }
        }
      }
      if (scope !== 'block') {
        const block = blockBounds(idx, s)
        if (block && (block[0] < s || block[1] > e)) { fixed = block; scope = 'block'; return scope }
      }
      return null
    },
    result() {
      const [start, end] = bounds()
      return { start, end, scope }
    },
    rects() {
      const [s, e] = bounds()
      const range = e > s ? toRange(doc, idx, s, e) : null
      return range ? rectsOf(range) : []
    },
  }
  return session
}
