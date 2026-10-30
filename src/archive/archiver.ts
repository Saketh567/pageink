/**
 * Saves a page's stylesheets, fonts and pictures with the page, so it looks right offline, does not change when the site changes,
 * and stops reporting your reading to the site. Runs in the background after import; the page opens straight away and behaves as
 * before until saving finishes. Any single file that cannot be saved is skipped, never an error. The stored page then refers to each
 * saved file by a pk-asset:<hash> token (see resolve.ts), and files are stored once each by the hash of their bytes.
 */
import DOMPurify from 'dompurify'
import { getDb } from '../store/db.ts'
import { getPage, getSnapshot, listPages, patchPage, putSnapshot } from '../store/repo.ts'
import { collectAssets } from './collect.ts'
import { findImports, rewriteCss } from './css.ts'
import { archiveProgress } from './progress.ts'

export interface Fetched { bytes: ArrayBuffer; type: string }
export type FetchAsset = (url: string) => Promise<Fetched | null>

/** A page may keep this many files and this many bytes; the rest is left pointing at the original site. */
const MAX_ASSETS = 300
const MAX_BYTES = 30 * 1024 * 1024
const PARALLEL = 6
/** How many levels of @import are followed. */
const CSS_DEPTH = 2

/** Requests start at most this often (about 8 a second), which stays under the server's per-minute allowance even for a big page. */
const PACE_MS = 120

/** Asks the server for one file (browsers will not let the app read other sites' files directly). Failure is just null. */
export function apiFetchAsset(key: string): FetchAsset {
  let slot = 0
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
  return async (url) => {
    // a busy moment (429) or a server hiccup (5xx) is worth waiting out; a real "no" (404, not a picture, blocked) is not
    for (let attempt = 0; attempt < 4; attempt++) {
      const now = Date.now()
      const wait = Math.max(0, slot - now)
      slot = Math.max(slot, now) + PACE_MS
      if (wait) await sleep(wait)
      try {
        const res = await fetch('/api/asset', { method: 'POST', headers: { 'content-type': 'application/json', ...(key ? { authorization: `Bearer ${key}` } : {}) }, body: JSON.stringify({ url }) })
        if (res.ok) return { bytes: await res.arrayBuffer(), type: res.headers.get('content-type') ?? '' }
        if (res.status !== 429 && res.status < 500) return null
        if (res.status !== 429 && attempt >= 1) return null // a server hiccup gets one quick second try, not a long wait
        // when busy the server says how long to hold off; everyone behind us waits too, so we do not make it worse
        const hold = res.status === 429 ? Math.min(30, Number(res.headers.get('retry-after')) || 2 * (attempt + 1)) * 1000 : 1000
        slot = Math.max(slot, Date.now() + hold)
      } catch {
        return null
      }
    }
    return null
  }
}

async function sha256Hex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Runs `fn` over `items`, at most `n` at a time. */
async function pool<T>(items: T[], n: number, fn: (item: T) => Promise<void>) {
  let next = 0
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) await fn(items[next++])
  }))
}

export type ArchiveResult = 'complete' | 'partial' | 'skipped'

/** One run per page at a time: opening a page while its import is still saving must not start a second, competing run. */
const running = new Map<string, Promise<ArchiveResult>>()

export function archivePage(pageId: string, opts: { fetchAsset?: FetchAsset; appKey?: string; onProgress?(saved: number, total: number): void } = {}): Promise<ArchiveResult> {
  const have = running.get(pageId)
  if (have) return have
  const p = archive(pageId, opts).finally(() => running.delete(pageId))
  running.set(pageId, p)
  return p
}

async function archive(pageId: string, opts: { fetchAsset?: FetchAsset; appKey?: string; onProgress?(saved: number, total: number): void }): Promise<ArchiveResult> {
  const [snap, page] = await Promise.all([getSnapshot(pageId), getPage(pageId)])
  if (!snap || !page?.url) return 'skipped' // files have no address to resolve relative pictures against
  if (snap.archive?.state === 'complete') return 'complete'
  const base = page.url
  const fetchAsset = opts.fetchAsset ?? apiFetchAsset(opts.appKey ?? '')
  const doc = new DOMParser().parseFromString(snap.html, 'text/html')
  const db = await getDb()

  const tally = { total: 0, saved: 0, bytes: 0, hashes: new Set<string>() }
  const progress = () => {
    archiveProgress.value = { ...archiveProgress.value, [pageId]: { saved: tally.saved, total: tally.total } }
    opts.onProgress?.(tally.saved, tally.total)
  }

  /** One picture, font, or file used by styles: fetched once, stored by the hash of its bytes. Null when it was not saved. */
  const files = new Map<string, Promise<{ hash: string } | null>>()
  const saveFile = (url: string) => {
    let p = files.get(url)
    if (!p) {
      tally.total++
      p = (async () => {
        if (files.size > MAX_ASSETS) return null
        const got = await fetchAsset(url)
        if (!got || tally.bytes + got.bytes.byteLength > MAX_BYTES) return null
        const type = got.type.split(';')[0].trim()
        let bytes = got.bytes
        if (type === 'image/svg+xml') {
          // an SVG can carry script: keep only the safe parts (it is only ever shown as a picture, but never trust a stored file)
          bytes = new TextEncoder().encode(DOMPurify.sanitize(new TextDecoder().decode(bytes), { USE_PROFILES: { svg: true, svgFilters: true } })).buffer as ArrayBuffer
        }
        const hash = await sha256Hex(bytes)
        if (!(await db.get('blobs', hash))) await db.put('blobs', { id: hash, type, data: bytes })
        tally.bytes += bytes.byteLength
        tally.saved++
        tally.hashes.add(hash)
        progress()
        return { hash }
      })()
      files.set(url, p)
    }
    return p
  }

  /** A stylesheet's text, or null. Counted like a file so progress covers everything. */
  const fetchCss = async (url: string) => {
    tally.total++
    const got = await fetchAsset(url)
    if (!got || !/css/i.test(got.type)) return null
    tally.saved++
    progress()
    return new TextDecoder().decode(got.bytes)
  }

  /** Styles with their @imports pulled in and every font and picture address replaced by a saved-file token. */
  async function inlineCss(text: string, cssUrl: string, depth: number): Promise<string> {
    if (depth < CSS_DEPTH) {
      for (const imp of findImports(text, cssUrl)) {
        const css = await fetchCss(imp.url)
        if (css !== null) text = text.replace(imp.rule, `\n${await inlineCss(css, imp.url, depth + 1)}\n`)
      }
    }
    const found = rewriteCss(text, cssUrl, () => null).urls
    const saved = new Map<string, string>()
    await pool(found, PARALLEL, async (u) => {
      const r = await saveFile(u)
      if (r) saved.set(u, `pk-asset:${r.hash}`)
    })
    return rewriteCss(text, cssUrl, (abs) => saved.get(abs) ?? null).css
  }

  const plan = collectAssets(doc, base)
  progress()

  // stylesheets become inline <style> blocks that remember where they came from
  await pool(plan.links, 4, async ({ el, url }) => {
    const css = await fetchCss(url)
    if (css === null) return
    const style = doc.createElement('style')
    style.setAttribute('data-pk-orig', url)
    const media = el.getAttribute('media')
    if (media) style.setAttribute('media', media)
    style.textContent = await inlineCss(css, url, 0)
    el.replaceWith(style)
  })
  for (const st of Array.from(doc.querySelectorAll('style:not([data-pk-orig])'))) st.textContent = await inlineCss(st.textContent ?? '', base, 0)
  for (const el of Array.from(doc.querySelectorAll('[style]')).filter((e) => e.getAttribute('style')?.includes('url('))) el.setAttribute('style', await inlineCss(el.getAttribute('style') ?? '', base, 0))

  // pictures, in document order, a few at a time
  await pool(plan.images, PARALLEL, async ({ el, attr, url }) => {
    const r = await saveFile(url)
    if (!r) return
    el.setAttribute(attr, `pk-asset:${r.hash}`)
    if (!el.hasAttribute('data-pk-orig')) el.setAttribute('data-pk-orig', url)
  })

  // the page may have been captured again while we worked: never overwrite a newer copy with an older one
  const latest = await getSnapshot(pageId)
  const { [pageId]: _done, ...others } = archiveProgress.value
  archiveProgress.value = others
  if (!latest || latest.html !== snap.html) return 'skipped'
  const state = tally.saved === tally.total ? 'complete' : 'partial'
  await putSnapshot({
    ...latest,
    html: '<!doctype html>' + doc.documentElement.outerHTML,
    assets: Array.from(new Set([...(latest.assets ?? []), ...tally.hashes])),
    archive: { state, saved: tally.saved, total: tally.total, bytes: tally.bytes, at: new Date().toISOString() },
  })
  await patchPage(pageId, { offline: state })
  return state
}

/** Saves every page that has an address and is not yet complete, one at a time, and says how many ended complete or only partly. */
export async function archiveAll(opts: { appKey?: string; fetchAsset?: FetchAsset; onProgress?(done: number, total: number): void } = {}): Promise<{ complete: number; partial: number }> {
  const todo = (await listPages()).filter((p) => p.url && p.offline !== 'complete')
  const fetchAsset = opts.fetchAsset ?? apiFetchAsset(opts.appKey ?? '') // one pace for the whole run, not one per page
  const tally = { complete: 0, partial: 0 }
  for (let i = 0; i < todo.length; i++) {
    opts.onProgress?.(i, todo.length)
    const r = await archivePage(todo[i].id, { fetchAsset })
    if (r === 'complete') tally.complete++
    else if (r === 'partial') tally.partial++
  }
  opts.onProgress?.(todo.length, todo.length)
  return tally
}
