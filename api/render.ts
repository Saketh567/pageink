import chromium from '@sparticuz/chromium'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import puppeteer from 'puppeteer-core'
import { checkAuth } from './_lib/auth.ts'
import { validateTarget } from './_lib/guard.ts'
import { renderLimiter } from './_lib/limits.ts'
import { createRequestGuard } from './_lib/render-guard.ts'
import { MAX_BYTES } from './_lib/safe-fetch.ts'

const LAYOUT_WIDTH = 1280
const NAV_TIMEOUT_MS = 20_000

function fail(res: VercelResponse, status: number, error: string, message: string) {
  res.status(status).json({ error, message })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return fail(res, 405, 'BAD_URL', 'POST only')

  const auth = checkAuth(req.headers.authorization, process.env.APP_KEY)
  if (auth === 'unconfigured') return fail(res, 503, 'UNAUTHORIZED', 'Server key not configured')
  if (auth === 'unauthorized') return fail(res, 401, 'UNAUTHORIZED', 'Key rejected')
  if (!renderLimiter()) return fail(res, 429, 'RATE_LIMITED', 'Too many renders, try again in a minute')

  const target = validateTarget(typeof req.body?.url === 'string' ? req.body.url : '')
  if (!target.ok) return fail(res, 400, target.code, target.code)

  const allowed = createRequestGuard()
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: 'shell',
    })
    const page = await browser.newPage()
    await page.setViewport({ width: LAYOUT_WIDTH, height: 1000 })
    page.on('dialog', (d) => void d.dismiss())
    await page.setRequestInterception(true)
    page.on('request', (r) => {
      void allowed(r.url(), r.resourceType()).then((ok) => (ok ? r.continue() : r.abort('blockedbyclient')))
    })

    const response = await page.goto(target.url.href, { waitUntil: 'networkidle2', timeout: NAV_TIMEOUT_MS })
    const status = response?.status() ?? 0
    if (status >= 400) return fail(res, 502, `UPSTREAM_${status}`, `UPSTREAM_${status}`)

    // trigger lazy-loaded images and sections
    await page.evaluate(async () => {
      for (let i = 0; i < 30 && window.scrollY + innerHeight < document.documentElement.scrollHeight; i++) {
        window.scrollBy(0, 800)
        await new Promise((r) => setTimeout(r, 100))
      }
      window.scrollTo(0, 0)
    })

    const html = await page.content()
    if (Buffer.byteLength(html) > MAX_BYTES) return fail(res, 413, 'TOO_LARGE', 'TOO_LARGE')
    res.status(200).json({ html, finalUrl: page.url(), status, fetchedAt: new Date().toISOString() })
  } catch (e) {
    const timeout = e instanceof Error && /timeout/i.test(e.name + e.message)
    fail(res, timeout ? 504 : 502, timeout ? 'TIMEOUT' : 'UPSTREAM_502', timeout ? 'TIMEOUT' : 'Render failed') // never log the URL
  } finally {
    await browser?.close().catch(() => {})
  }
}
