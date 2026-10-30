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
