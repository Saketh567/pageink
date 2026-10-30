/**
 * Finds what a saved page needs to look right on its own: its stylesheets and its pictures. Part of saving pages for offline,
 * used by archiver.ts. Works on the snapshot document, where every picture's address is parked in data-pk-src / data-pk-srcset.
 */

/** The absolute http(s) address for `v` as seen from `base`, or null (data:, saved-asset tokens, javascript:, nonsense). */
export function absUrl(v: string | null | undefined, base: string): string | null {
  if (!v) return null
  try {
    const u = new URL(v.trim(), base)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null
  } catch {
    return null
  }
}

/**
 * The one picture worth saving from a srcset: the largest that is at most 1600 px wide (or 2x), else the smallest there is.
 * The saved page keeps just this one, which is plenty for a screen and keeps the archive small.
 */
export function bestSrcset(srcset: string, base: string): string | null {
  const cands: Array<{ url: string; w: number }> = []
  for (const m of srcset.matchAll(/\s*([^\s,]+)(?:\s+(\d+(?:\.\d+)?)(w|x))?\s*(?:,|$)/g)) {
    const url = absUrl(m[1], base)
    if (!url) continue
    const n = m[2] ? Number(m[2]) : 1
    cands.push({ url, w: m[3] === 'x' ? n * 800 : m[3] === 'w' ? n : 800 }) // x descriptors are scaled so 2x counts as 1600
  }
  if (!cands.length) return null
  const fit = cands.filter((c) => c.w <= 1600).sort((a, b) => b.w - a.w)[0]
  return (fit ?? cands.sort((a, b) => a.w - b.w)[0]).url
}

export interface AssetPlan {
  /** <link rel=stylesheet> elements and where to fetch them. */
  links: Array<{ el: HTMLLinkElement; url: string }>
  /** Elements whose parked picture address (data-pk-src or data-pk-srcset) should be replaced by a saved copy. */
  images: Array<{ el: Element; attr: 'data-pk-src' | 'data-pk-srcset'; url: string }>
}

export function collectAssets(doc: Document, base: string): AssetPlan {
  const links: AssetPlan['links'] = []
  doc.querySelectorAll<HTMLLinkElement>('link[rel~="stylesheet"][href]').forEach((el) => {
    const url = absUrl(el.getAttribute('href'), base)
    if (url) links.push({ el, url })
  })
  const images: AssetPlan['images'] = []
  doc.querySelectorAll('img[data-pk-src]').forEach((el) => {
    const url = absUrl(el.getAttribute('data-pk-src'), base)
    if (url) images.push({ el, attr: 'data-pk-src', url })
  })
  doc.querySelectorAll('img[data-pk-srcset], source[data-pk-srcset]').forEach((el) => {
    const url = bestSrcset(el.getAttribute('data-pk-srcset') ?? '', base)
    if (url) images.push({ el, attr: 'data-pk-srcset', url })
  })
  return { links, images }
}
