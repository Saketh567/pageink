import { createHash, timingSafeEqual } from 'node:crypto'

const digest = (s: string) => createHash('sha256').update(s).digest()

/**
 * Bearer-token check against APP_KEY (constant time). Missing env means the server is not configured.
 * Both sides are trimmed: a key pasted into Vercel with a trailing space or newline must still match.
 */
export function checkAuth(header: string | undefined, appKey: string | undefined): 'ok' | 'unauthorized' | 'unconfigured' {
  const key = appKey?.trim()
  if (!key) return 'unconfigured'
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : ''
  return timingSafeEqual(digest(token), digest(key)) ? 'ok' : 'unauthorized'
}

type Headers = Record<string, string | string[] | undefined>
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

/**
 * Who may use the import endpoints. No secret has to live in the app (a browser bundle cannot keep one):
 * a request is allowed if it comes from this site's own pages (the browser sets Sec-Fetch-Site and Origin,
 * and page scripts on other sites cannot forge them), or if it carries the optional APP_KEY.
 * shortcut: a script outside a browser can fake those headers; per-visitor rate limits and the SSRF guard
 * are the backstop. Upgrade to sign-in or Turnstile if abuse appears.
 */
export function checkAccess(headers: Headers, appKey: string | undefined): 'ok' | 'unauthorized' {
  if (checkAuth(one(headers.authorization), appKey) === 'ok') return 'ok'
  if (one(headers['sec-fetch-site']) === 'same-origin') return 'ok'
  const origin = one(headers.origin)
  const host = one(headers.host)
  try {
    if (origin && host && new URL(origin).host === host) return 'ok'
  } catch { /* malformed Origin is simply not allowed */ }
  return 'unauthorized'
}

/** Best guess at the visitor's address behind Vercel's proxy. */
export function clientIp(headers: Headers): string {
  return one(headers['x-forwarded-for'])?.split(',')[0].trim() || one(headers['x-real-ip']) || 'unknown'
}
