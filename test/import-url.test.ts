// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { ImportError, importUrl } from '../src/import/import-url.ts'
import { getDb } from '../src/store/db.ts'

const PAGE = `<!doctype html><title>Ok</title><h1>Ok</h1>${'<p>enough real readable text to count as a content page. </p>'.repeat(10)}`
const ok = (html = PAGE) => new Response(JSON.stringify({ html, finalUrl: 'https://site.example/x', status: 200 }), { status: 200 })
const err = (status: number, error?: string) => new Response(error ? JSON.stringify({ error }) : 'Internal Server Error', { status })

function stubApi(routes: { fetch: Response; render?: Response }) {
  const calls: string[] = []
  vi.stubGlobal('fetch', async (path: string) => {
    calls.push(path.replace('/api/', ''))
    return path.endsWith('/fetch') ? routes.fetch : (routes.render ?? err(500, 'SERVER'))
  })
  return calls
}

// importing a page you already have returns it, so every test starts with an empty library
afterEach(async () => {
  vi.unstubAllGlobals()
  await (await getDb()).clear('pages')
})

describe('importUrl fallback', () => {
  test('a normal page uses fetch only', async () => {
    const calls = stubApi({ fetch: ok() })
    const page = await importUrl('site.example/x', 1280, 'k')
    expect(calls).toEqual(['fetch'])
    expect(page.captureMethod).toBe('fetch')
  })

  test.each([['403 from the site', err(403, 'UPSTREAM_403')], ['site 500', err(500, 'UPSTREAM_500')], ['our function crashing (no JSON)', err(500)], ['timeout', err(504, 'TIMEOUT')]])(
    'retries rendered when %s',
    async (_n, bad) => {
      const calls = stubApi({ fetch: bad, render: ok() })
      const page = await importUrl('https://site.example/x', 1280, 'k')
      expect(calls).toEqual(['fetch', 'render'])
      expect(page.captureMethod).toBe('render')
    },
  )

  test('a big page that is nearly all script data (products arrive by script) is rendered', async () => {
    const shell = `<!doctype html><title>Shop</title><h1>Shoes</h1><p>${'a few words of text. '.repeat(30)}</p><script>${'x'.repeat(150_000)}</script>`
    const calls = stubApi({ fetch: ok(shell), render: ok() })
    const page = await importUrl('https://shop.example/shoes', 1280, 'k')
    expect(calls).toEqual(['fetch', 'render'])
    expect(page.captureMethod).toBe('render')
  })

  test('does not render for a 404, a bad key or a blocked host', async () => {
    for (const [res, code] of [[err(404, 'UPSTREAM_404'), 'UPSTREAM_404'], [err(401, 'UNAUTHORIZED'), 'UNAUTHORIZED'], [err(400, 'BLOCKED_HOST'), 'BLOCKED_HOST']] as const) {
      const calls = stubApi({ fetch: res })
      await expect(importUrl('https://site.example/x', 1280, 'k')).rejects.toMatchObject({ code })
      expect(calls).toEqual(['fetch'])
    }
  })

  test('if rendering also fails, the render error is shown', async () => {
    stubApi({ fetch: err(403, 'UPSTREAM_403'), render: err(504, 'TIMEOUT') })
    const e = await importUrl('https://site.example/x', 1280, 'k').catch((x) => x)
    expect(e).toBeInstanceOf(ImportError)
    expect(e.code).toBe('TIMEOUT')
  })

  test('an empty app shell still renders, and a failed render keeps the thin copy', async () => {
    const calls = stubApi({ fetch: ok('<!doctype html><title>App</title><div id="root"></div>'), render: err(500, 'SERVER') })
    const page = await importUrl('https://site.example/x', 1280, 'k')
    expect(calls).toEqual(['fetch', 'render'])
    expect(page.captureMethod).toBe('fetch')
  })
})
