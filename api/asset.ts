/**
 * Fetches one picture, stylesheet or font that a page uses, so the app can save it with the page (browsers will not let the app
 * read other sites' files directly). Same protections as /api/fetch: calls only from the app, rate limited, public addresses only,
 * pinned connection, size and time caps, no URL logging. Only pictures, styles and fonts are returned, and always with headers
 * that stop the file from ever running as a page.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { checkAccess, clientIp } from './_lib/auth.ts'
import { assetLimiter } from './_lib/limits.ts'
import { FetchError, safeFetchAsset } from './_lib/safe-fetch.ts'

function fail(res: VercelResponse, status: number, error: string, message: string) {
  res.status(status).json({ error, message })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return fail(res, 405, 'BAD_URL', 'POST only')

  if (checkAccess(req.headers, process.env.APP_KEY) !== 'ok') return fail(res, 401, 'UNAUTHORIZED', 'Requests must come from the PageInk app')
  if (!assetLimiter(clientIp(req.headers))) { res.setHeader('Retry-After', '20'); return fail(res, 429, 'RATE_LIMITED', 'Too many requests, try again in a minute') }

  const url = typeof req.body?.url === 'string' ? req.body.url : ''
  try {
    const a = await safeFetchAsset(url)
    res.setHeader('Content-Type', a.type)
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox") // even if opened as a page it can do nothing
    res.setHeader('Content-Disposition', 'attachment')
    res.setHeader('X-Final-Url', a.finalUrl)
    res.status(200)
    res.end(Buffer.from(a.bytes))
  } catch (e) {
    if (e instanceof FetchError) {
      const status = e.code === 'BAD_URL' || e.code === 'BLOCKED_HOST' ? 400 : e.code === 'TIMEOUT' ? 504 : e.code === 'TOO_LARGE' ? 413 : e.code === 'NOT_ASSET' || e.code === 'NOT_HTML' ? 415 : 502
      return fail(res, status, e.code, e.message)
    }
    console.error('asset failed:', e instanceof Error ? `${e.name}: ${e.message}` : String(e)) // never log the URL
    fail(res, 500, 'SERVER', 'Unexpected server error')
  }
}
