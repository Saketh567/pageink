import { describe, expect, test } from 'vitest'
import { checkAccess, checkAuth, clientIp } from '../api/_lib/auth.ts'
import { createKeyedLimiter, createLimiter } from '../api/_lib/limits.ts'
import { FetchError, MAX_BYTES, safeFetch, type SafeFetchDeps } from '../api/_lib/safe-fetch.ts'

const html = (body: BodyInit, type = 'text/html; charset=utf-8', status = 200, extra: Record<string, string> = {}) =>
  new Response(body, { status, headers: { 'content-type': type, ...extra } })

const pub = async () => [{ address: '93.184.216.34', family: 4 }]

async function codeOf(p: Promise<unknown>) {
  try { await p } catch (e) { return (e as FetchError).code }
  return 'none'
}

describe('safeFetch', () => {
  test('returns html and the final URL', async () => {
    const deps: SafeFetchDeps = { lookup: pub, request: async () => html('<p>hi</p>') }
    expect(await safeFetch('https://example.com/a', deps)).toEqual({ html: '<p>hi</p>', finalUrl: 'https://example.com/a', status: 200 })
  })

  test('pins the validated address into the request', async () => {
    let seen = ''
    await safeFetch('https://example.com', { lookup: pub, request: async (_u, i) => (seen = i.address, html('x')) })
    expect(seen).toBe('93.184.216.34')
  })

  test('blocks a host that resolves to a private address', async () => {
    const lookup = async () => [{ address: '169.254.169.254', family: 4 }]
    expect(await codeOf(safeFetch('https://example.com', { lookup, request: async () => html('x') }))).toBe('BLOCKED_HOST')
  })

  test('blocks if any resolved address is private', async () => {
    const lookup = async () => [{ address: '93.184.216.34', family: 4 }, { address: '10.0.0.1', family: 4 }]
    expect(await codeOf(safeFetch('https://example.com', { lookup, request: async () => html('x') }))).toBe('BLOCKED_HOST')
  })

  test('re-validates every redirect hop', async () => {
    const lookup = async (h: string) => [{ address: h === 'evil.example' ? '169.254.169.254' : '93.184.216.34', family: 4 }]
    const request = async () => new Response(null, { status: 302, headers: { location: 'https://evil.example/' } })
    expect(await codeOf(safeFetch('https://example.com', { lookup, request }))).toBe('BLOCKED_HOST')
  })

  test('follows a relative redirect', async () => {
    let n = 0
    const request = async () => (n++ ? html('landed') : new Response(null, { status: 301, headers: { location: '/next' } }))
    expect((await safeFetch('https://example.com/a', { lookup: pub, request })).finalUrl).toBe('https://example.com/next')
  })

  test('stops after 5 redirects', async () => {
    const request = async () => new Response(null, { status: 302, headers: { location: '/again' } })
    expect(await codeOf(safeFetch('https://example.com', { lookup: pub, request }))).toBe('UPSTREAM_508')
  })

  test('rejects a body over 4 MB', async () => {
    const big = new Uint8Array(MAX_BYTES + 1)
    expect(await codeOf(safeFetch('https://example.com', { lookup: pub, request: async () => html(big) }))).toBe('TOO_LARGE')
  })

  test('rejects non-HTML', async () => {
    expect(await codeOf(safeFetch('https://example.com', { lookup: pub, request: async () => html('%PDF', 'application/pdf') }))).toBe('NOT_HTML')
  })

  test('maps upstream errors', async () => {
    expect(await codeOf(safeFetch('https://example.com', { lookup: pub, request: async () => html('no', 'text/html', 404) }))).toBe('UPSTREAM_404')
  })

  test('rejects a literal private URL before any lookup', async () => {
    expect(await codeOf(safeFetch('http://127.0.0.1', { lookup: pub, request: async () => html('x') }))).toBe('BLOCKED_HOST')
  })
})

describe('checkAuth', () => {
  test('accepts the right key, rejects wrong or missing, flags unconfigured', () => {
    expect(checkAuth('Bearer secret', 'secret')).toBe('ok')
    expect(checkAuth('Bearer nope', 'secret')).toBe('unauthorized')
    expect(checkAuth(undefined, 'secret')).toBe('unauthorized')
    expect(checkAuth('secret', 'secret')).toBe('unauthorized')
    expect(checkAuth('Bearer x', undefined)).toBe('unconfigured')
  })

  test('stray whitespace around the stored key or the typed key does not break the match', () => {
    expect(checkAuth('Bearer secret', 'secret\n')).toBe('ok')
    expect(checkAuth('Bearer secret', ' secret ')).toBe('ok')
    expect(checkAuth('Bearer secret ', 'secret')).toBe('ok')
    expect(checkAuth('Bearer secret', '   ')).toBe('unconfigured')
  })
})

describe('createLimiter', () => {
  test('refuses the 31st call in a minute and resets after the window', () => {
    let t = 0
    const allow = createLimiter(30, 60_000, () => t)
    for (let i = 0; i < 30; i++) expect(allow()).toBe(true)
    expect(allow()).toBe(false)
    t = 60_000
    expect(allow()).toBe(true)
  })
})

describe('checkAccess (no key needed from the app itself)', () => {
  test('allows requests from the app itself', () => {
    expect(checkAccess({ 'sec-fetch-site': 'same-origin' }, undefined)).toBe('ok')
    expect(checkAccess({ origin: 'https://pageink1.vercel.app', host: 'pageink1.vercel.app' }, undefined)).toBe('ok')
    expect(checkAccess({ 'sec-fetch-site': 'same-origin' }, 'secret')).toBe('ok')
  })
  test('refuses other sites, bare requests and malformed origins', () => {
    expect(checkAccess({ 'sec-fetch-site': 'cross-site' }, undefined)).toBe('unauthorized')
    expect(checkAccess({ origin: 'https://evil.example', host: 'pageink1.vercel.app' }, undefined)).toBe('unauthorized')
    expect(checkAccess({ origin: 'not a url', host: 'pageink1.vercel.app' }, undefined)).toBe('unauthorized')
    expect(checkAccess({}, undefined)).toBe('unauthorized')
    expect(checkAccess({ origin: 'https://pageink1.vercel.app.evil.example', host: 'pageink1.vercel.app' }, undefined)).toBe('unauthorized')
  })
  test('the optional key still works for scripts, and a wrong key does not', () => {
    expect(checkAccess({ authorization: 'Bearer secret' }, 'secret')).toBe('ok')
    expect(checkAccess({ authorization: 'Bearer wrong' }, 'secret')).toBe('unauthorized')
    expect(checkAccess({ authorization: 'Bearer secret' }, undefined)).toBe('unauthorized')
  })
  test('clientIp takes the first forwarded address', () => {
    expect(clientIp({ 'x-forwarded-for': '203.0.113.9, 10.0.0.1' })).toBe('203.0.113.9')
    expect(clientIp({ 'x-real-ip': '198.51.100.2' })).toBe('198.51.100.2')
    expect(clientIp({})).toBe('unknown')
  })
})

describe('createKeyedLimiter', () => {
  test('each visitor gets their own allowance and windows reset', () => {
    let t = 0
    const allow = createKeyedLimiter(2, 1000, () => t)
    expect([allow('a'), allow('a'), allow('a'), allow('b')]).toEqual([true, true, false, true])
    t = 1000
    expect(allow('a')).toBe(true)
  })
})
