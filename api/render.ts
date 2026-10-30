import chromium from '@sparticuz/chromium'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import puppeteer from 'puppeteer-core'
import { checkAccess, clientIp } from './_lib/auth.ts'
import { validateTarget } from './_lib/guard.ts'
import { renderLimiter } from './_lib/limits.ts'
import { startPinProxy } from './_lib/pin-proxy.ts'
import { createRequestGuard } from './_lib/render-guard.ts'
import { MAX_BYTES } from './_lib/safe-fetch.ts'

const LAYOUT_WIDTH = 1280
const NAV_TIMEOUT_MS = 20_000
const SCROLL_BUDGET_MS = 16_000
/** A page may not make more requests than this, or download more than this much, while it is being rendered (stops it being used to flood other sites). */
const MAX_REQUESTS = 400
const MAX_DOWNLOAD_BYTES = 40 * 1024 * 1024
/** Vercel refuses responses over 4.5 MB; leave room for the JSON wrapping. */
const MAX_RESPONSE_CHARS = 4_300_000
/** Chromium flags that weaken the browser's own protections, removed from the defaults the package ships. */
const UNSAFE_FLAGS = ['--disable-web-security', '--disable-site-isolation-trials']
const EXTRA_FLAGS = ['--disable-webrtc', '--force-webrtc-ip-handling-policy=disable_non_proxied_udp', '--disable-dev-shm-usage']

function fail(res: VercelResponse, status: number, error: string, message: string) {
  res.status(status).json({ error, message })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return fail(res, 405, 'BAD_URL', 'POST only')

  if (checkAccess(req.headers, process.env.APP_KEY) !== 'ok') return fail(res, 401, 'UNAUTHORIZED', 'Requests must come from the PageInk app')
  if (!renderLimiter(clientIp(req.headers))) return fail(res, 429, 'RATE_LIMITED', 'Too many renders, try again in a minute')

  const target = validateTarget(typeof req.body?.url === 'string' ? req.body.url : '')
  if (!target.ok) return fail(res, 400, target.code, target.code)

  const allowed = createRequestGuard()
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined
  let proxy: Awaited<ReturnType<typeof startPinProxy>> | undefined
  try {
    // all browser traffic goes through a proxy that resolves and validates every host itself (no DNS rebinding)
    proxy = await startPinProxy()
    browser = await puppeteer.launch({
      args: [
        ...chromium.args.filter((a) => !UNSAFE_FLAGS.some((f) => a.startsWith(f))),
        ...EXTRA_FLAGS,
        `--proxy-server=http://127.0.0.1:${proxy.port}`,
        '--proxy-bypass-list=<-loopback>', // even loopback goes through the proxy, which refuses it
      ],
      executablePath: await chromium.executablePath(),
      headless: 'shell',
    })
    const page = await browser.newPage()
    await page.setViewport({ width: LAYOUT_WIDTH, height: 1000 })
    page.on('dialog', (d) => void d.dismiss())
    await page.setRequestInterception(true)
    let requests = 0
    let bytes = 0
    page.on('response', (r) => { bytes += Number(r.headers()['content-length'] ?? 0) })
    page.on('request', (r) => {
      requests++
      const over = requests > MAX_REQUESTS || bytes > MAX_DOWNLOAD_BYTES
      void (over ? Promise.resolve(false) : allowed(r.url(), r.resourceType())).then((ok) => (ok ? r.continue() : r.abort('blockedbyclient')))
    })

    // 'networkidle' never comes on sites with constant analytics, so load the document and then wait for quiet, but not for ever
    const response = await page.goto(target.url.href, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS })
    const status = response?.status() ?? 0
    if (status >= 400) return fail(res, 502, `UPSTREAM_${status}`, `UPSTREAM_${status}`)
    await page.waitForNetworkIdle({ idleTime: 700, timeout: 6000 }).catch(() => {})

    // Scroll the whole page at reading pace: lazy images and sections only load when they come into view, and need a moment to swap in.
    const deadline = Date.now() + SCROLL_BUDGET_MS
    await page.evaluate(async (until: number) => {
      const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
      let stable = 0
      let last = 0
      while (Date.now() < until) {
        window.scrollBy(0, Math.round(innerHeight * 0.7))
        await wait(220)
        const h = document.documentElement.scrollHeight
        const atBottom = window.scrollY + innerHeight >= h - 4
        stable = atBottom && h === last ? stable + 1 : 0
        last = h
        if (stable >= 2) break // at the bottom and nothing more is being added
      }
      window.scrollTo(0, 0)
    }, deadline)
    await page.waitForNetworkIdle({ idleTime: 600, timeout: 5000 }).catch(() => {})
    // give the pictures that were asked for a moment to arrive, so the copy is not captured half-loaded
    await page.evaluate(async () => {
      const pending = Array.from(document.images).filter((i) => i.currentSrc && !i.complete)
      await Promise.race([Promise.all(pending.map((i) => new Promise((r) => { i.onload = i.onerror = () => r(null) }))), new Promise((r) => setTimeout(r, 4000))])
    }).catch(() => {})

    // a blocked navigation leaves the browser on its own error page: never hand that back as if it were the site
    const finalUrl = page.url()
    const ended = validateTarget(finalUrl)
    if (!ended.ok) return fail(res, 502, 'UPSTREAM_502', 'Render failed')

    const html = await page.content()
    if (Buffer.byteLength(html) > MAX_BYTES || html.length > MAX_RESPONSE_CHARS) return fail(res, 413, 'TOO_LARGE', 'TOO_LARGE')
    res.status(200).json({ html, finalUrl, status, fetchedAt: new Date().toISOString() })
  } catch (e) {
    const timeout = e instanceof Error && /timeout/i.test(e.name + e.message)
    fail(res, timeout ? 504 : 502, timeout ? 'TIMEOUT' : 'UPSTREAM_502', timeout ? 'TIMEOUT' : 'Render failed') // never log the URL
  } finally {
    await browser?.close().catch(() => {})
    await proxy?.close().catch(() => {})
  }
}
