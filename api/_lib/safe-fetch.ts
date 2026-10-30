/**
 * Downloads a page (or a picture, stylesheet or font used by one) for import: public addresses only, redirects re-checked at
 * every hop, the validated IP pinned for the connection (defeats DNS rebinding), a size cap and a timeout.
 */
import { lookup as dnsLookup } from 'node:dns/promises'
import { Agent, fetch as undiciFetch } from 'undici'
import { isPrivateIp, validateTarget } from './guard.ts'

export type FetchErrorCode =
  | 'BAD_URL' | 'BLOCKED_HOST' | 'NOT_HTML' | 'NOT_ASSET' | 'TOO_LARGE' | 'TIMEOUT' | `UPSTREAM_${number}`

export class FetchError extends Error {
  code: FetchErrorCode
  constructor(code: FetchErrorCode, message: string = code) {
    super(message)
    this.code = code
  }
}

export interface SafeFetchResult { html: string; finalUrl: string; status: number }

export interface SafeFetchDeps {
  lookup?: (host: string) => Promise<Array<{ address: string; family: number }>>
  /** Receives the validated, pinned address so a test (or undici) connects to exactly that IP. */
  request?: (url: string, init: { address: string; family: number; signal: AbortSignal; headers: Record<string, string> }) => Promise<Response>
}

export const MAX_BYTES = 4 * 1024 * 1024
const MAX_HOPS = 5
const TIMEOUT_MS = 10_000
const UA = 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'

const defaultLookup = (host: string) => dnsLookup(host, { all: true })

/** Connects through an undici Agent whose DNS answer is the address we already validated (defeats rebinding). */
const defaultRequest: NonNullable<SafeFetchDeps['request']> = async (url, { address, family, signal, headers }) => {
  const dispatcher = new Agent({
    keepAliveTimeout: 1, // this agent serves one request, so do not hold its socket open
    connect: {
      lookup: (_h, opts, cb) => {
        if ((opts as { all?: boolean }).all) (cb as unknown as (e: null, a: unknown) => void)(null, [{ address, family }])
        else cb(null, address, family)
      },
    },
  })
  return undiciFetch(url, { dispatcher, signal, headers, redirect: 'manual' }) as unknown as Promise<Response>
}

/**
 * The shared, guarded download: validates the address, checks every host it resolves to, connects to the checked address, follows
 * redirects by hand (each hop validated again) and returns the first successful response, unread.
 */
async function guardedGet(rawUrl: string, deps: SafeFetchDeps, accept: string): Promise<{ res: Response; finalUrl: string }> {
  const lookup = deps.lookup ?? defaultLookup
  const request = deps.request ?? defaultRequest
  const signal = AbortSignal.timeout(TIMEOUT_MS)
  let current = rawUrl

  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    const v = validateTarget(current)
    if (!v.ok) throw new FetchError(v.code)
    let addrs: Array<{ address: string; family: number }>
    try {
      addrs = await lookup(v.url.hostname)
    } catch {
      throw new FetchError('BAD_URL', 'Host not found')
    }
    if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new FetchError('BLOCKED_HOST')

    let res: Response
    try {
      res = await request(v.url.href, { ...addrs[0], signal, headers: { 'user-agent': UA, accept } })
    } catch (e) {
      if (signal.aborted) throw new FetchError('TIMEOUT')
      throw new FetchError('UPSTREAM_502', 'fetch failed') // never echo the network error: it would tell a caller what an address does
    }

    const loc = res.headers.get('location')
    if (res.status >= 300 && res.status < 400 && loc) {
      current = new URL(loc, v.url).href
      continue
    }
    if (res.status < 200 || res.status >= 300) throw new FetchError(`UPSTREAM_${res.status}`)
    return { res, finalUrl: v.url.href }
  }
  throw new FetchError('UPSTREAM_508', 'Too many redirects')
}

export async function safeFetch(rawUrl: string, deps: SafeFetchDeps = {}): Promise<SafeFetchResult> {
  const { res, finalUrl } = await guardedGet(rawUrl, deps, 'text/html,application/xhtml+xml')
  const type = res.headers.get('content-type') ?? ''
  if (!/^(text\/html|application\/xhtml\+xml)/i.test(type)) throw new FetchError('NOT_HTML')
  return { html: decode(await readBytes(res), type), finalUrl, status: res.status }
}

const ASSET_ACCEPT = 'image/avif,image/webp,image/*,text/css,font/*;q=0.9,*/*;q=0.1'
/** Pictures, styles and fonts only: nothing that could run as a page or script. */
const ASSET_TYPE = /^(image\/(png|jpeg|gif|webp|avif|svg\+xml|x-icon|vnd\.microsoft\.icon)|text\/css|font\/(woff2|woff|ttf|otf)|application\/(font-woff2?|x-font-ttf|vnd\.ms-fontobject|font-sfnt))$/
const FONT_BY_EXTENSION: Record<string, string> = { woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', otf: 'font/otf' }

export interface AssetResult { bytes: Uint8Array; type: string; finalUrl: string }

/** One picture, stylesheet or font used by a page. Same address checks, pinning and caps as a page download. */
export async function safeFetchAsset(rawUrl: string, deps: SafeFetchDeps = {}): Promise<AssetResult> {
  const { res, finalUrl } = await guardedGet(rawUrl, deps, ASSET_ACCEPT)
  let type = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
  if (type === 'application/octet-stream') {
    // some hosts serve fonts without a type; accept that only when the file name says font
    const ext = /\.(woff2?|ttf|otf)$/i.exec(new URL(finalUrl).pathname)?.[1]?.toLowerCase()
    if (ext) type = FONT_BY_EXTENSION[ext]
  }
  if (!ASSET_TYPE.test(type)) throw new FetchError('NOT_ASSET')
  return { bytes: await readBytes(res), type, finalUrl }
}

/** Reads a response body, giving up as soon as it passes the size cap. */
async function readBytes(res: Response): Promise<Buffer> {
  const reader = res.body?.getReader()
  if (!reader) return Buffer.alloc(0)
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_BYTES) {
      await reader.cancel()
      throw new FetchError('TOO_LARGE')
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks)
}

function decode(bytes: Buffer, type: string): string {
  const charset = /charset=["']?([\w-]+)/i.exec(type)?.[1] ?? 'utf-8'
  try {
    return new TextDecoder(charset).decode(bytes)
  } catch {
    return new TextDecoder('utf-8').decode(bytes)
  }
}
