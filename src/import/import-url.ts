import { findPageByUrl, getPage, patchPage, putSnapshot, savePage } from '../store/repo.ts'
import type { Page } from '../store/schema.ts'
import { inspectHtml, sanitize, SANITIZER_VERSION } from './sanitize.ts'

export class ImportError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

const MESSAGES: Record<string, string> = {
  BAD_URL: 'That does not look like a web address.',
  BLOCKED_HOST: 'That address is not allowed (private or local network).',
  NOT_HTML: 'That link is not a web page (it may be a PDF or a file).',
  TOO_LARGE: 'That page is too large to import.',
  TIMEOUT: 'The site took too long to answer.',
  RATE_LIMITED: 'Too many imports, wait a minute and try again.',
  UNAUTHORIZED: 'The server did not accept this request. If the server owner set an access key, add it in Settings.',
  SERVER: 'The PageInk server had a problem. Try again in a moment.',
  UPSTREAM_401: 'The site blocked the request (it may need a login or block automated access).',
  UPSTREAM_403: 'The site blocked the request (it may block automated access).',
  UPSTREAM_404: 'That page was not found (404).',
  UPSTREAM_429: 'The site is rate limiting requests. Try again later.',
}

interface ApiOk { html: string; finalUrl: string }

async function callApi(path: string, url: string, key: string): Promise<ApiOk> {
  let res: Response
  try {
    res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json', ...(key ? { authorization: `Bearer ${key}` } : {}) }, body: JSON.stringify({ url }) })
  } catch {
    throw new ImportError('OFFLINE', 'You appear to be offline.')
  }
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    // no JSON error body means our own function failed (crash, timeout, size), not the target site
    const code = String(body.error ?? 'SERVER')
    throw new ImportError(code, MESSAGES[code] ?? (code.startsWith('UPSTREAM_') ? `The site answered with an error (${code.slice(9)}).` : 'Import failed.'))
  }
  return body as ApiOk
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Sanitize and store a snapshot as a new page (docHeight is measured the first time the page opens). */
export async function storePage(opts: {
  html: string; url: string; title: string; method: Page['captureMethod']; layoutWidth: number
}): Promise<Page> {
  const html = sanitize(opts.html, opts.url || undefined)
  const info = inspectHtml(opts.html, opts.url || undefined) // raw HTML still has the meta tags
  const now = new Date().toISOString()
  let origin = 'file:'
  try { if (opts.url) origin = new URL(opts.url).origin } catch { /* keep file: */ }
  const page: Page = {
    id: crypto.randomUUID(), schemaVersion: 1, url: opts.url, siteOrigin: origin,
    title: opts.title || info.title || (opts.url ? new URL(opts.url).hostname : 'Untitled'),
    captureMethod: opts.method, capturedAt: now, layoutWidth: opts.layoutWidth, docHeight: 0,
    textHash: await sha256(new DOMParser().parseFromString(html, 'text/html').body.textContent ?? ''),
    tags: [], cover: info.cover, description: info.description, openedAt: now, createdAt: now, updatedAt: now,
  }
  await savePage(page)
  await putSnapshot({ pageId: page.id, html, sanitizerVersion: SANITIZER_VERSION })
  return page
}

/** Fetch fast; if the page is an empty app shell, render it in headless Chrome instead. */
export async function importUrl(
  rawUrl: string, layoutWidth: number, key: string, onProgress: (msg: string) => void = () => {},
): Promise<Page> {
  let url = rawUrl.trim()
  if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) url = 'https://' + url
  const have = await findPageByUrl(url) // already in the library: open it, no need to fetch it again
  if (have) return have
  onProgress('Fetching page…')
  let r: ApiOk
  let method: Page['captureMethod'] = 'fetch'
  try {
    r = await callApi('/api/fetch', url, key)
  } catch (e) {
    // sites that refuse a plain request (403/5xx) or time out often serve a real browser, so retry rendered
    const blocked = e instanceof ImportError && (e.code.startsWith('UPSTREAM_') && e.code !== 'UPSTREAM_404' || e.code === 'SERVER' || e.code === 'TIMEOUT')
    if (!blocked) throw e
    onProgress('Site blocked a plain fetch, rendering…')
    r = await callApi('/api/render', url, key)
    method = 'render'
  }
  const again = await findPageByUrl(r.finalUrl) // the address may have redirected to a page you already have
  if (again) return again
  const info = inspectHtml(r.html)
  // little readable text, or a big file that is nearly all script data (a shop whose products arrive by script), means the content is not in it
  const scriptHeavy = info.textLength < 1500 && r.html.length > 100_000
  if (method === 'fetch' && (info.textLength < 200 || info.emptyRoot || scriptHeavy)) {
    onProgress('Rendering JavaScript…')
    try {
      r = await callApi('/api/render', r.finalUrl, key)
      method = 'render'
    } catch (e) {
      // a thin static copy is still better than nothing; auth/limit errors should surface though
      if (e instanceof ImportError && (e.code === 'UNAUTHORIZED' || e.code === 'RATE_LIMITED')) throw e
    }
  }
  onProgress('Saving…')
  return storePage({ html: r.html, url: r.finalUrl, title: '', method, layoutWidth })
}

export async function pageExists(id: string) {
  return !!(await getPage(id))
}

/**
 * Capture a saved page again, keeping its marks (they find their words again). `render` runs the site's scripts first, which fills in
 * shops and apps whose content arrives by script; `fetch` is the quick plain copy.
 */
export async function recapturePage(pageId: string, how: 'render' | 'fetch', key: string, onProgress: (msg: string) => void = () => {}): Promise<Page> {
  const page = await getPage(pageId)
  if (!page?.url) throw new ImportError('BAD_URL', 'This page was imported from a file, so there is no address to load again.')
  onProgress(how === 'render' ? 'Loading the full page, this can take up to a minute…' : 'Fetching page…')
  const r = await callApi(how === 'render' ? '/api/render' : '/api/fetch', page.url, key)
  const html = sanitize(r.html, r.finalUrl)
  await putSnapshot({ pageId, html, sanitizerVersion: SANITIZER_VERSION })
  const next = { captureMethod: how === 'render' ? 'render' : 'fetch', capturedAt: new Date().toISOString(), docHeight: 0, textHash: await sha256(new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '') } as const
  await patchPage(pageId, next)
  return { ...page, ...next }
}
