import { getPage, putSnapshot, savePage } from '../store/repo.ts'
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
  UNAUTHORIZED: 'Key rejected. Check your key in Settings.',
}

interface ApiOk { html: string; finalUrl: string }

async function callApi(path: string, url: string, key: string): Promise<ApiOk> {
  let res: Response
  try {
    res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` }, body: JSON.stringify({ url }) })
  } catch {
    throw new ImportError('OFFLINE', 'You appear to be offline.')
  }
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const code = String(body.error ?? 'UPSTREAM_500')
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
  const info = inspectHtml(html)
  const now = new Date().toISOString()
  let origin = 'file:'
  try { if (opts.url) origin = new URL(opts.url).origin } catch { /* keep file: */ }
  const page: Page = {
    id: crypto.randomUUID(), schemaVersion: 1, url: opts.url, siteOrigin: origin,
    title: opts.title || info.title || (opts.url ? new URL(opts.url).hostname : 'Untitled'),
    captureMethod: opts.method, capturedAt: now, layoutWidth: opts.layoutWidth, docHeight: 0,
    textHash: await sha256(new DOMParser().parseFromString(html, 'text/html').body.textContent ?? ''),
    tags: [], createdAt: now, updatedAt: now,
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
  onProgress('Fetching page…')
  let r = await callApi('/api/fetch', url, key)
  let method: Page['captureMethod'] = 'fetch'
  const info = inspectHtml(r.html)
  if (info.textLength < 200 || info.emptyRoot) {
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
