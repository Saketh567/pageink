// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { archivePage, apiFetchAsset, type FetchAsset } from '../src/archive/archiver.ts'
import { withAssetUrls } from '../src/archive/resolve.ts'
import { sanitize } from '../src/import/sanitize.ts'
import { getDb } from '../src/store/db.ts'
import { deletePage, getAsset, getPage, getSnapshot, putSnapshot, savePage } from '../src/store/repo.ts'
import type { Page } from '../src/store/schema.ts'

const T = '2026-01-01T00:00:00.000Z'
const BASE = 'https://site.example/shop/page.html'
const page = (id: string, url = BASE): Page => ({ id, schemaVersion: 2, url, siteOrigin: 'https://site.example', title: id, captureMethod: 'fetch', capturedAt: T, layoutWidth: 0, docHeight: 100, textHash: '', tags: [], createdAt: T, updatedAt: T })
const bytes = (s: string) => new TextEncoder().encode(s).buffer as ArrayBuffer

async function sha(text: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes(text))), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** What a site serves, by address. Anything not listed is "missing" (the server could not fetch it). */
function site(extra: Record<string, { type: string; body: string }> = {}) {
  const files: Record<string, { type: string; body: string }> = {
    'https://site.example/s.css': { type: 'text/css', body: '@import "/imp.css"; @font-face{font-family:F;src:url(f.woff2)} .h{background:url(bg.png)}' },
    'https://site.example/imp.css': { type: 'text/css', body: '.i{background:url("i.png")}' },
    'https://site.example/f.woff2': { type: 'font/woff2', body: 'FONTBYTES' },
    'https://site.example/bg.png': { type: 'image/png', body: 'BGPNG' },
    'https://site.example/i.png': { type: 'image/png', body: 'IPNG' },
    'https://site.example/inline.png': { type: 'image/png', body: 'INLINEPNG' },
    'https://site.example/a.png': { type: 'image/png', body: 'APNG' },
    'https://site.example/b.png': { type: 'image/png', body: 'BPNG' },
    'https://site.example/b2.png': { type: 'image/png', body: 'B2PNG' },
    'https://site.example/c.svg': { type: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><circle r="5" onload="x()"/></svg>' },
    'https://site.example/d.png': { type: 'image/png', body: 'DPNG' },
    ...extra,
  }
  const calls: string[] = []
  const fetchAsset: FetchAsset = async (url) => {
    calls.push(url)
    const f = files[url]
    return f ? { bytes: bytes(f.body), type: f.type } : null
  }
  return { fetchAsset, calls }
}

const RAW = `<!doctype html><title>Shop</title><link rel="stylesheet" href="/s.css"><style>.x{background:url(/inline.png)}</style>
<body><img id="a1" src="/a.png"><img id="a2" src="/a.png"><img id="b" src="/b.png" srcset="/b1.png 400w, /b2.png 900w, /b3.png 2400w"><img id="c" src="/c.svg"><div id="d" style="background:url('/d.png')">x</div></body>`

async function open(id: string, raw = RAW) {
  await savePage(page(id))
  await putSnapshot({ pageId: id, html: sanitize(raw, BASE), sanitizerVersion: 3 })
}

beforeEach(async () => {
  const db = await getDb()
  for (const s of ['pages', 'snapshots', 'blobs', 'texts'] as const) await db.clear(s)
})

describe('archivePage', () => {
  test('saves styles (with imports), fonts, pictures and an SVG, and the page ends complete', async () => {
    await open('p')
    expect(await archivePage('p', { fetchAsset: site().fetchAsset })).toBe('complete')
    const snap = (await getSnapshot('p'))!
    expect(snap.archive?.state).toBe('complete')
    expect(snap.archive?.saved).toBe(snap.archive?.total)
    expect(snap.html).not.toMatch(/<link[^>]+stylesheet/) // inlined
    expect(snap.html).toContain('data-pk-orig="https://site.example/s.css"')
    expect(snap.html).toContain('.i{background:url("pk-asset:') // the imported sheet was pulled in and tokenised
    expect(snap.html).toContain('@font-face')
    expect(snap.html).not.toContain('url("https://site.example/') // nothing left pointing at the site
    expect((await getPage('p'))?.offline).toBe('complete')
    expect(snap.assets!.length).toBeGreaterThanOrEqual(8)
  })

  test('every picture address becomes a token and remembers where it came from; a srcset keeps its best candidate only', async () => {
    await open('p')
    await archivePage('p', { fetchAsset: site().fetchAsset })
    const doc = new DOMParser().parseFromString((await getSnapshot('p'))!.html, 'text/html')
    const a1 = doc.getElementById('a1')!
    expect(a1.getAttribute('data-pk-src')).toMatch(/^pk-asset:[0-9a-f]{64}$/)
    expect(a1.getAttribute('data-pk-orig')).toBe('https://site.example/a.png')
    const b = doc.getElementById('b')!
    expect(b.getAttribute('data-pk-srcset')).toBe(`pk-asset:${await sha('B2PNG')}`) // the 900w one: largest not above 1600
    expect(doc.getElementById('d')!.getAttribute('style')).toMatch(/pk-asset:[0-9a-f]{64}/)
  })

  test('a duplicate picture is stored once', async () => {
    await open('p')
    await archivePage('p', { fetchAsset: site().fetchAsset })
    const doc = new DOMParser().parseFromString((await getSnapshot('p'))!.html, 'text/html')
    expect(doc.getElementById('a1')!.getAttribute('data-pk-src')).toBe(doc.getElementById('a2')!.getAttribute('data-pk-src'))
    expect(await (await getDb()).count('blobs', await sha('APNG'))).toBe(1)
  })

  test('an SVG loses its script and event handlers before it is stored', async () => {
    await open('p')
    await archivePage('p', { fetchAsset: site().fetchAsset })
    const doc = new DOMParser().parseFromString((await getSnapshot('p'))!.html, 'text/html')
    const hash = doc.getElementById('c')!.getAttribute('data-pk-src')!.slice('pk-asset:'.length)
    const stored = new TextDecoder().decode((await getAsset(hash))!.data)
    expect(stored).toContain('circle')
    expect(stored).not.toMatch(/script|onload|alert/)
  })

  test('running it again fetches nothing', async () => {
    await open('p')
    const s = site()
    await archivePage('p', { fetchAsset: s.fetchAsset })
    const before = s.calls.length
    expect(await archivePage('p', { fetchAsset: s.fetchAsset })).toBe('complete')
    expect(s.calls.length).toBe(before)
  })

  test('a file that cannot be saved makes the page partial, and trying again fetches only what is missing', async () => {
    await open('p')
    const s = site()
    let fail = true
    const fetchAsset: FetchAsset = async (u) => (fail && u.endsWith('d.png') ? (s.calls.push(u), null) : s.fetchAsset(u))
    expect(await archivePage('p', { fetchAsset })).toBe('partial')
    expect((await getPage('p'))?.offline).toBe('partial')
    expect((await getSnapshot('p'))!.html).toContain('/d.png') // still points at the original
    fail = false
    s.calls.length = 0
    expect(await archivePage('p', { fetchAsset })).toBe('complete')
    expect(s.calls).toEqual(['https://site.example/d.png']) // only the missing one
  })

  test('nothing is thrown when every fetch fails: the page stays pointing at the site', async () => {
    await open('p')
    expect(await archivePage('p', { fetchAsset: async () => null })).toBe('partial')
    expect((await getSnapshot('p'))!.html).toContain('data-pk-src="/a.png"')
  })

  test('files over the per-page limit are left alone and the page is partial', async () => {
    const imgs = Array.from({ length: 320 }, (_, i) => `<img src="/many/${i}.png">`).join('')
    const files: Record<string, { type: string; body: string }> = {}
    for (let i = 0; i < 320; i++) files[`https://site.example/many/${i}.png`] = { type: 'image/png', body: `PNG${i}` }
    await open('big', `<title>Big</title><body>${imgs}</body>`)
    expect(await archivePage('big', { fetchAsset: site(files).fetchAsset })).toBe('partial')
    const snap = (await getSnapshot('big'))!
    expect(snap.archive!.saved).toBeLessThanOrEqual(301)
    expect(snap.archive!.saved).toBeLessThan(snap.archive!.total)
  })

  test('a page captured again while saving is not overwritten with the older copy', async () => {
    await open('p')
    const s = site()
    const slow: FetchAsset = async (u) => {
      if (u.endsWith('a.png')) await putSnapshot({ pageId: 'p', html: sanitize('<title>New</title><p>new capture</p>', BASE), sanitizerVersion: 3 })
      return s.fetchAsset(u)
    }
    expect(await archivePage('p', { fetchAsset: slow })).toBe('skipped')
    expect((await getSnapshot('p'))!.html).toContain('new capture')
  })

  test('a file import (no address) is skipped', async () => {
    await savePage(page('f', ''))
    await putSnapshot({ pageId: 'f', html: '<p>x</p>', sanitizerVersion: 3 })
    expect(await archivePage('f', { fetchAsset: async () => null })).toBe('skipped')
  })
})

describe('showing and deleting a saved page', () => {
  test('tokens become blob addresses for showing, and a missing file shows as empty instead of broken', async () => {
    await open('p')
    await archivePage('p', { fetchAsset: site().fetchAsset })
    const snap = (await getSnapshot('p'))!
    const made: string[] = []
    const realCreate = URL.createObjectURL
    URL.createObjectURL = (b: Blob | MediaSource) => { made.push((b as Blob).type); return `blob:test/${made.length}` }
    URL.revokeObjectURL = () => {}
    try {
      const shown = await withAssetUrls(snap.html, getAsset)
      expect(shown.html).not.toMatch(/pk-asset:/)
      expect(shown.html).toMatch(/blob:test\/\d+/)
      expect(made).toContain('image/png')
      expect(made).toContain('font/woff2')
      const missing = await withAssetUrls(`<img data-pk-src="pk-asset:${'0'.repeat(64)}">`, async () => undefined)
      expect(missing.html).toContain('data-pk-src="data:,"')
    } finally {
      URL.createObjectURL = realCreate
    }
  })

  test('deleting a page removes its saved files except those another page still uses', async () => {
    await open('one')
    await open('two', `<title>Two</title><body><img src="/a.png"></body>`)
    const s = site()
    await archivePage('one', { fetchAsset: s.fetchAsset })
    await archivePage('two', { fetchAsset: s.fetchAsset })
    const shared = await sha('APNG') // used by both pages
    const onlyOne = await sha('BGPNG') // only page one's stylesheet uses it
    await deletePage('one')
    expect(await getAsset(shared)).toBeDefined()
    expect(await getAsset(onlyOne)).toBeUndefined()
    await deletePage('two')
    expect(await getAsset(shared)).toBeUndefined()
    expect(await (await getDb()).count('blobs')).toBe(0)
  })
})

describe('running safely', () => {
  test('two runs started at once for the same page share one: every file is fetched once', async () => {
    await open('p')
    const s = site()
    const [a, b] = await Promise.all([archivePage('p', { fetchAsset: s.fetchAsset }), archivePage('p', { fetchAsset: s.fetchAsset })])
    expect([a, b]).toEqual(['complete', 'complete'])
    expect(s.calls.length).toBe(new Set(s.calls).size)
  })
})

describe('apiFetchAsset', () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

  test('waits out a busy moment (429) and then succeeds', async () => {
    vi.useFakeTimers()
    let n = 0
    vi.stubGlobal('fetch', async () => (++n < 3 ? new Response('{}', { status: 429 }) : new Response(new Uint8Array([1, 2]), { headers: { 'content-type': 'image/png' } })))
    const p = apiFetchAsset('')('https://x.example/a.png')
    await vi.advanceTimersByTimeAsync(20_000)
    expect(await p).toMatchObject({ type: 'image/png' })
    expect(n).toBe(3)
  })

  test('requests are spaced out so a big page cannot exceed the per-minute allowance', async () => {
    vi.useFakeTimers()
    const starts: number[] = []
    vi.stubGlobal('fetch', async () => (starts.push(Date.now()), new Response(new Uint8Array([1]), { headers: { 'content-type': 'image/png' } })))
    const get = apiFetchAsset('')
    const all = Promise.all(Array.from({ length: 6 }, () => get('https://x.example/a.png')))
    await vi.advanceTimersByTimeAsync(5_000)
    await all
    for (let i = 1; i < starts.length; i++) expect(starts[i] - starts[i - 1]).toBeGreaterThanOrEqual(115)
  })

  test('on a busy answer it holds off for as long as the server asks, for everything behind it too', async () => {
    vi.useFakeTimers()
    const starts: number[] = []
    let n = 0
    vi.stubGlobal('fetch', async () => (starts.push(Date.now()), ++n === 1 ? new Response('{}', { status: 429, headers: { 'retry-after': '20' } }) : new Response(new Uint8Array([1]), { headers: { 'content-type': 'image/png' } })))
    const get = apiFetchAsset('')
    const p = get('https://x.example/a.png')
    await vi.advanceTimersByTimeAsync(30_000)
    expect(await p).not.toBeNull()
    expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(19_900)
  })

  test('does not retry a real refusal (404 or not a picture)', async () => {
    let n = 0
    vi.stubGlobal('fetch', async () => (n++, new Response('{}', { status: 415 })))
    expect(await apiFetchAsset('')('https://x.example/a.html')).toBeNull()
    expect(n).toBe(1)
  })

  test('gives up quietly after repeated trouble, and when the network is gone', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', async () => new Response('{}', { status: 503 }))
    const p = apiFetchAsset('')('https://x.example/a.png')
    await vi.advanceTimersByTimeAsync(60_000)
    expect(await p).toBeNull()
    vi.stubGlobal('fetch', async () => { throw new TypeError('offline') })
    expect(await apiFetchAsset('')('https://x.example/a.png')).toBeNull()
  })

  test('sends the access key only when there is one', async () => {
    const seen: Array<Record<string, string>> = []
    vi.stubGlobal('fetch', async (_u: string, init: { headers: Record<string, string> }) => (seen.push(init.headers), new Response('{}', { status: 415 })))
    await apiFetchAsset('')('https://x.example/a.png')
    await apiFetchAsset('k1')('https://x.example/a.png')
    expect(seen[0].authorization).toBeUndefined()
    expect(seen[1].authorization).toBe('Bearer k1')
  })
})
