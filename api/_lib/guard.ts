/**
 * First line of defence against SSRF: only public http(s) addresses may be fetched. Rejects private, loopback,
 * link-local and other internal addresses, including tricky spellings of them.
 */
import { isIP } from 'node:net'

export type GuardResult = { ok: true; url: URL } | { ok: false; code: 'BAD_URL' | 'BLOCKED_HOST' }

const BLOCKED_SUFFIXES = ['.localhost', '.local', '.internal', '.home.arpa']

/**
 * Is this a URL the server may fetch? The WHATWG parser already turns decimal, hex and octal
 * IPv4 spellings into dotted form, so one dotted-quad check covers all of them.
 */
export function validateTarget(raw: string): GuardResult {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return { ok: false, code: 'BAD_URL' }
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { ok: false, code: 'BAD_URL' }
  if (url.username || url.password) return { ok: false, code: 'BAD_URL' }
  if (url.port !== '' && url.port !== '80' && url.port !== '443') return { ok: false, code: 'BLOCKED_HOST' }
  const host = url.hostname.toLowerCase().replace(/\.$/, '')
  if (!host || isIP(host) || host.startsWith('[') || !host.includes('.') || host === 'localhost') {
    return { ok: false, code: 'BLOCKED_HOST' }
  }
  if (BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) return { ok: false, code: 'BLOCKED_HOST' }
  return { ok: true, url }
}

function v4Private(a: number, b: number, c: number): boolean {
  return (
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19))
  )
}

function expandV6(ip: string): number[] | null {
  let s = ip.toLowerCase().split('%')[0]
  const tail = s.match(/(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
  if (tail) {
    const [x, y, z, w] = tail.slice(1).map(Number)
    s = s.slice(0, tail.index) + ((x << 8) | y).toString(16) + ':' + ((z << 8) | w).toString(16)
  }
  const halves = s.split('::')
  if (halves.length > 2) return null
  const head = halves[0] ? halves[0].split(':') : []
  const rest = halves.length === 2 && halves[1] ? halves[1].split(':') : []
  const fill = 8 - head.length - rest.length
  if (halves.length === 1 ? head.length !== 8 : fill < 1) return null
  const groups = [...head, ...Array(halves.length === 2 ? fill : 0).fill('0'), ...rest].map((h) => parseInt(h, 16))
  return groups.length === 8 && groups.every((n) => n >= 0 && n <= 0xffff) ? groups : null
}

/** True for loopback, private, link-local, multicast and other non-public addresses. Unparseable input counts as private. */
export function isPrivateIp(ip: string): boolean {
  const kind = isIP(ip.split('%')[0])
  if (kind === 4) {
    const [a, b, c] = ip.split('.').map(Number)
    return v4Private(a, b, c)
  }
  if (kind === 6) {
    const g = expandV6(ip)
    if (!g) return true
    if (g.slice(0, 5).every((n) => n === 0) && g[5] === 0xffff) return v4Private(g[6] >> 8, g[6] & 255, g[7] >> 8)
    if (g.every((n) => n === 0) || (g.slice(0, 7).every((n) => n === 0) && g[7] === 1)) return true
    return (g[0] & 0xfe00) === 0xfc00 || (g[0] & 0xffc0) === 0xfe80 || (g[0] & 0xff00) === 0xff00
  }
  return true
}
