import { createHash, timingSafeEqual } from 'node:crypto'

const digest = (s: string) => createHash('sha256').update(s).digest()

/** Bearer-token check against APP_KEY (constant time). Missing env means the server is not configured. */
export function checkAuth(header: string | undefined, appKey: string | undefined): 'ok' | 'unauthorized' | 'unconfigured' {
  if (!appKey) return 'unconfigured'
  const token = header?.startsWith('Bearer ') ? header.slice(7) : ''
  return timingSafeEqual(digest(token), digest(appKey)) ? 'ok' : 'unauthorized'
}
