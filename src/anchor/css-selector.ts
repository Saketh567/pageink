/**
 * Builds a stable CSS selector for an element (ignoring generated ids and classes) and finds it again later, so
 * ink can stay with the thing it was drawn on.
 */
import type { Pt } from '../viewer/coords.ts'

/** Ids like "radix-:r1:" or "a3f9c2e81b" change on every build, so they are not worth anchoring to. */
const GENERATED = /\d{4,}|[a-f0-9]{8,}|:r[0-9a-z]*:|«/i
const esc = (s: string) => s.replace(/[^\w-]/g, '\\$&')

/** A CSS path to an element, preferring a stable unique id. */
export function selectorFor(el: Element): string {
  const parts: string[] = []
  for (let e: Element | null = el; e && e.tagName !== 'HTML'; e = e.parentElement) {
    if (e.id && !GENERATED.test(e.id) && e.ownerDocument.querySelectorAll(`#${esc(e.id)}`).length === 1) {
      parts.unshift(`#${esc(e.id)}`)
      break
    }
    const same = e.parentElement ? Array.from(e.parentElement.children).filter((c) => c.tagName === e.tagName) : [e]
    const tag = e.tagName.toLowerCase()
    parts.unshift(same.length > 1 ? `${tag}:nth-of-type(${same.indexOf(e) + 1})` : tag)
  }
  return parts.join('>')
}

export function resolve(css: string, doc: Document): Element | null {
  try { return doc.querySelector(css) } catch { return null }
}

export interface ElementAnchor { css: string; rx: number; ry: number }
const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

/** The element under a document point, and where inside its box the point is (0 to 1). */
export function elementAnchor(doc: Document, x: number, y: number): ElementAnchor | null {
  const el = doc.elementFromPoint(x, y)
  if (!el || el === doc.documentElement) return null
  const r = el.getBoundingClientRect()
  return { css: selectorFor(el), rx: r.width ? clamp01((x - r.left) / r.width) : 0, ry: r.height ? clamp01((y - r.top) / r.height) : 0 }
}

export function elementPoint(doc: Document, a: ElementAnchor): Pt | null {
  const el = resolve(a.css, doc)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: r.left + a.rx * r.width, y: r.top + a.ry * r.height }
}
