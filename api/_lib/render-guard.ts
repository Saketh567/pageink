import { lookup as dnsLookup } from 'node:dns/promises'
import { isPrivateIp, validateTarget } from './guard.ts'

const BLOCKED_TYPES = new Set(['media', 'websocket', 'eventsource', 'ping'])

export type Lookup = (host: string) => Promise<Array<{ address: string }>>

/**
 * Should the headless browser be allowed to make this request? Same rules as safeFetch:
 * public http(s) hosts only, and every resolved address must be public. Results are cached per host.
 */
export function createRequestGuard(lookup: Lookup = (h) => dnsLookup(h, { all: true }), now: () => number = Date.now) {
  const cache = new Map<string, { ok: boolean; until: number }>()
  return async (url: string, resourceType: string): Promise<boolean> => {
    if (url.startsWith('data:') || url.startsWith('blob:')) return resourceType !== 'media'
    if (BLOCKED_TYPES.has(resourceType)) return false
    const v = validateTarget(url)
    if (!v.ok) return false
    const host = v.url.hostname
    const hit = cache.get(host)
    if (hit && hit.until > now()) return hit.ok
    let ok = false
    try {
      const addrs = await lookup(host)
      ok = addrs.length > 0 && !addrs.some((a) => isPrivateIp(a.address))
    } catch { /* unresolvable host: block */ }
    cache.set(host, { ok, until: now() + 60_000 })
    return ok
  }
}
