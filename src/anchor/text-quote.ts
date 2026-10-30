/**
 * Text anchoring (W3C TextQuote + TextPosition). A highlight is remembered as the exact words plus the text around
 * them, so it still finds its place if the page is re-captured or reflowed.
 */
export interface TextIndex { text: string; nodes: Array<{ node: Text; start: number; end: number }> }
export interface Quote { exact: string; prefix: string; suffix: string }
export interface TextSelector { quote: Quote; position: { start: number; end: number } }

const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'])
const CONTEXT = 32
const cache = new WeakMap<Document, TextIndex>()

/** Every visible text node in order, with its offset in the page's combined text. Cached per document. */
export function textIndex(doc: Document): TextIndex {
  const hit = cache.get(doc)
  if (hit) return hit
  const nodes: TextIndex['nodes'] = []
  let text = ''
  const walker = doc.createTreeWalker(doc.body, 4 /* NodeFilter.SHOW_TEXT */)
  for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
    if (SKIP.has(n.parentElement?.tagName ?? '')) continue
    const v = n.nodeValue ?? ''
    nodes.push({ node: n, start: text.length, end: text.length + v.length })
    text += v
  }
  const index = { text, nodes }
  cache.set(doc, index)
  return index
}

/** Offset in the combined text for a DOM position (text node + offset, or an element + child index). */
export function offsetOf(index: TextIndex, node: Node, offset: number): number | null {
  if (node.nodeType === 3) {
    const e = index.nodes.find((x) => x.node === node)
    return e ? e.start + Math.min(offset, e.end - e.start) : null
  }
  const child = node.childNodes[offset]
  if (child) return index.nodes.find((x) => child === x.node || child.contains(x.node))?.start ?? null
  const inside = index.nodes.filter((x) => node.contains(x.node))
  return inside.length ? inside[inside.length - 1].end : null
}

export function describe(index: TextIndex, start: number, end: number): TextSelector {
  const { text } = index
  return {
    quote: { exact: text.slice(start, end), prefix: text.slice(Math.max(0, start - CONTEXT), start), suffix: text.slice(end, end + CONTEXT) },
    position: { start, end },
  }
}

const matchBack = (a: string, b: string) => { let n = 0; while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++; return n }
const matchFront = (a: string, b: string) => { let n = 0; while (n < a.length && n < b.length && a[n] === b[n]) n++; return n }

/** Where the quote lives now: the stored position if it still matches, else the best occurrence by surrounding text. */
export function anchorText(index: TextIndex, sel: TextSelector): { start: number; end: number } | null {
  const { text } = index
  const { exact, prefix, suffix } = sel.quote
  if (!exact) return null
  const { start, end } = sel.position
  if (text.slice(start, end) === exact) return { start, end }

  let best: { start: number; score: number; dist: number } | null = null
  for (let i = text.indexOf(exact); i !== -1; i = text.indexOf(exact, i + 1)) {
    const score = matchBack(text.slice(Math.max(0, i - CONTEXT), i), prefix) + matchFront(text.slice(i + exact.length, i + exact.length + CONTEXT), suffix)
    const dist = Math.abs(i - start)
    if (!best || score > best.score || (score === best.score && dist < best.dist)) best = { start: i, score, dist }
  }
  return best ? { start: best.start, end: best.start + exact.length } : null
}

export function toRange(doc: Document, index: TextIndex, start: number, end: number): Range | null {
  const a = index.nodes.find((x) => start >= x.start && start < x.end)
  const b = index.nodes.find((x) => end > x.start && end <= x.end)
  if (!a || !b) return null
  const r = doc.createRange()
  r.setStart(a.node, start - a.start)
  r.setEnd(b.node, end - b.start)
  return r
}

/** Line boxes of a range in document coordinates (the snapshot iframe is never scrolled, so client = document). */
export function rectsOf(range: Range): Array<{ x: number; y: number; w: number; h: number }> {
  return Array.from(range.getClientRects())
    .filter((r) => r.width > 1 && r.height > 1)
    .map((r) => ({ x: r.left, y: r.top, w: r.width, h: r.height }))
}
