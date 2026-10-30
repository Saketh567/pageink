/**
 * Reads and rewrites the addresses inside a stylesheet (url(...) and @import), so a page's styles can be saved with their fonts and
 * pictures. Part of saving pages for offline: called by the archiver (archiver.ts). Pure text functions, easy to test.
 */

const URL_RE = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s"']*))\s*\)/gi
const IMPORT_STRING_RE = /@import\s+(?:"([^"]*)"|'([^']*)')\s*([^;]*);?/gi
const IMPORT_URL_RE = /@import\s+url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s"']*))\s*\)\s*([^;]*);?/gi

/** Kept exactly as written: inline data, our own saved-asset tokens, and in-document references (SVG fragments). */
const keep = (v: string) => /^(data:|pk-asset:|#)/i.test(v)

/** The absolute http(s) address for `v` as seen from `base`, or null for anything else (javascript:, file:, blob:, nonsense). */
function absolute(v: string, base: string): string | null {
  try {
    const u = new URL(v, base)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null
  } catch {
    return null
  }
}

/** The @import rules of a stylesheet, with their absolute addresses. The archiver replaces each rule with the imported styles. */
export function findImports(css: string, cssUrl: string): Array<{ rule: string; url: string }> {
  const out: Array<{ rule: string; url: string }> = []
  for (const m of css.matchAll(IMPORT_URL_RE)) {
    const u = absolute((m[1] ?? m[2] ?? m[3] ?? '').trim(), cssUrl)
    if (u) out.push({ rule: m[0], url: u })
  }
  for (const m of css.matchAll(IMPORT_STRING_RE)) {
    const u = absolute((m[1] ?? m[2] ?? '').trim(), cssUrl)
    if (u) out.push({ rule: m[0], url: u })
  }
  return out
}

/**
 * Every address in the stylesheet, resolved against `cssUrl` (inlined styles would otherwise resolve against the page, not the
 * stylesheet). Each address is replaced by `map(address) ?? address`, always absolute, always as url("..."). Addresses with other
 * schemes are dropped to url(""). Returns the new text and the absolute addresses found, in order, without repeats.
 */
export function rewriteCss(css: string, cssUrl: string, map: (abs: string) => string | null): { css: string; urls: string[] } {
  const urls: string[] = []
  const seen = new Set<string>()
  const text = css
    // @import "x" becomes @import url("x"), so one rule below handles both spellings
    .replace(IMPORT_STRING_RE, (_m, a, b, rest) => `@import url("${a ?? b}")${rest ? ' ' + String(rest).trim() : ''};`)
    .replace(URL_RE, (whole, a, b, c) => {
      const v = String(a ?? b ?? c ?? '').trim()
      if (!v || keep(v)) return whole
      const abs = absolute(v, cssUrl)
      if (!abs) return 'url("")'
      if (!seen.has(abs)) { seen.add(abs); urls.push(abs) }
      return `url("${map(abs) ?? abs}")`
    })
  return { css: text, urls }
}
