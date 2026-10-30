import { describe, expect, test, vi } from 'vitest'
import handler from '../api/asset.ts'
import { FetchError, MAX_BYTES, safeFetchAsset, type SafeFetchDeps } from '../api/_lib/safe-fetch.ts'

const pub = async () => [{ address: '93.184.216.34', family: 4 }]
const file = (body: BodyInit, type: string, status = 200, extra: Record<string, string> = {}) =>
  new Response(body, { status, headers: { 'content-type': type, ...extra } })

async function codeOf(p: Promise<unknown>) {
  try { await p } catch (e) { return (e as FetchError).code }
  return 'none'
}

describe('safeFetchAsset: only pictures, styles and fonts', () => {
  const get = (r: Response, url = 'https://cdn.example/x') => safeFetchAsset(url, { lookup: pub, request: async () => r } as SafeFetchDeps)

  test.each([
    ['image/png', 'x.png'], ['image/jpeg', 'x.jpg'], ['image/svg+xml', 'x.svg'], ['text/css', 'x.css'], ['font/woff2', 'x.woff2'],
    ['image/webp; charset=binary', 'x.webp'], ['application/font-woff', 'x.woff'],
  ])('accepts %s', async (type, name) => {
    const a = await get(file('bytes', type), `https://cdn.example/${name}`)
    expect(a.type).toBe(type.split(';')[0])
    expect(new TextDecoder().decode(a.bytes)).toBe('bytes')
  })

  test.each(['text/html', 'application/javascript', 'text/javascript', 'application/json', 'application/pdf', 'video/mp4', ''])(
    'refuses %s as NOT_ASSET', async (type) => {
      expect(await codeOf(get(file('x', type)))).toBe('NOT_ASSET')
    })

  test('octet-stream is accepted only when the file name says it is a font', async () => {
    expect((await get(file('f', 'application/octet-stream'), 'https://cdn.example/a.woff2')).type).toBe('font/woff2')
    expect(await codeOf(get(file('f', 'application/octet-stream'), 'https://cdn.example/a.exe'))).toBe('NOT_ASSET')
    expect(await codeOf(get(file('f', 'application/octet-stream'), 'https://cdn.example/a'))).toBe('NOT_ASSET')
  })

  test('the 4 MB cap applies', async () => {
    expect(await codeOf(get(file(new Uint8Array(MAX_BYTES + 1), 'image/png')))).toBe('TOO_LARGE')
  })

  test('a redirect to an internal address is refused, and so is a host that resolves to one', async () => {
    const lookup = async (h: string) => [{ address: h === 'evil.example' ? '169.254.169.254' : '93.184.216.34', family: 4 }]
    const hop = async () => new Response(null, { status: 302, headers: { location: 'https://evil.example/x.png' } })
    expect(await codeOf(safeFetchAsset('https://cdn.example/x.png', { lookup, request: hop }))).toBe('BLOCKED_HOST')
    expect(await codeOf(safeFetchAsset('http://169.254.169.254/x.png', { lookup: pub, request: async () => file('x', 'image/png') }))).toBe('BLOCKED_HOST')
  })

  test('upstream errors keep their status', async () => {
    expect(await codeOf(get(file('no', 'text/plain', 404)))).toBe('UPSTREAM_404')
  })
})

/** A response that records what the handler writes, like Vercel's. */
function fakeRes() {
  const out = { status: 0, headers: {} as Record<string, string>, body: undefined as unknown, ended: false }
  const res = {
    setHeader: (k: string, v: string) => { out.headers[k.toLowerCase()] = v },
    status(c: number) { out.status = c; return res },
    json(b: unknown) { out.body = b; out.ended = true },
    end(b?: unknown) { out.body = b; out.ended = true },
  }
  return { res, out }
}
const req = (over: Record<string, unknown> = {}) => ({
  method: 'POST', headers: { 'sec-fetch-site': 'same-origin', 'x-forwarded-for': '203.0.113.9' }, body: { url: 'https://cdn.example/x.png' }, ...over,
})

describe('POST /api/asset', () => {
  test('refuses anything but POST', async () => {
    const { res, out } = fakeRes()
    await handler(req({ method: 'GET' }) as never, res as never)
    expect(out.status).toBe(405)
  })

  test('refuses a call from another website', async () => {
    const { res, out } = fakeRes()
    await handler(req({ headers: { 'sec-fetch-site': 'cross-site', origin: 'https://evil.example', host: 'pageink1.vercel.app' } }) as never, res as never)
    expect(out.status).toBe(401)
  })

  test('refuses a private address and does not echo the address back', async () => {
    const { res, out } = fakeRes()
    await handler(req({ body: { url: 'http://169.254.169.254/latest/meta-data/' } }) as never, res as never)
    expect(out.status).toBe(400)
    expect(JSON.stringify(out.body)).not.toContain('169.254')
  })

  test('a bad body is a bad address, not a crash', async () => {
    const { res, out } = fakeRes()
    await handler(req({ body: { url: 12 } }) as never, res as never)
    expect(out.status).toBe(400)
  })

  test('success carries the headers that stop a stored file from ever running as a page', async () => {
    vi.resetModules()
    vi.doMock('../api/_lib/safe-fetch.ts', async (orig) => ({
      ...(await orig<typeof import('../api/_lib/safe-fetch.ts')>()),
      safeFetchAsset: async () => ({ bytes: new Uint8Array([1, 2, 3]), type: 'image/png', finalUrl: 'https://cdn.example/x.png' }),
    }))
    const { default: h } = await import('../api/asset.ts')
    const { res, out } = fakeRes()
    await h(req() as never, res as never)
    expect(out.status).toBe(200)
    expect(out.headers['content-type']).toBe('image/png')
    expect(out.headers['content-security-policy']).toBe("default-src 'none'; sandbox")
    expect(out.headers['content-disposition']).toBe('attachment')
    expect(out.headers['x-content-type-options']).toBe('nosniff')
    expect(out.headers['cache-control']).toBe('no-store')
    expect(out.headers['x-final-url']).toBe('https://cdn.example/x.png')
    expect(Buffer.isBuffer(out.body)).toBe(true)
    vi.doUnmock('../api/_lib/safe-fetch.ts')
  })
})
