import type { VercelRequest, VercelResponse } from '@vercel/node'
import { checkAccess, clientIp } from './_lib/auth.ts'
import { fetchLimiter } from './_lib/limits.ts'
import { FetchError, safeFetch } from './_lib/safe-fetch.ts'

function fail(res: VercelResponse, status: number, error: string, message: string) {
  res.status(status).json({ error, message })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return fail(res, 405, 'BAD_URL', 'POST only')

  if (checkAccess(req.headers, process.env.APP_KEY) !== 'ok') return fail(res, 401, 'UNAUTHORIZED', 'Requests must come from the PageInk app')
  if (!fetchLimiter(clientIp(req.headers))) return fail(res, 429, 'RATE_LIMITED', 'Too many requests, try again in a minute')

  const url = typeof req.body?.url === 'string' ? req.body.url : ''
  try {
    const r = await safeFetch(url)
    if (r.html.length > 4_300_000) return fail(res, 413, 'TOO_LARGE', 'TOO_LARGE') // Vercel refuses responses over 4.5 MB
    res.status(200).json({ ...r, fetchedAt: new Date().toISOString() })
  } catch (e) {
    if (e instanceof FetchError) {
      const status = e.code === 'BAD_URL' || e.code === 'BLOCKED_HOST' ? 400 : e.code === 'TIMEOUT' ? 504 : e.code === 'TOO_LARGE' ? 413 : e.code === 'NOT_HTML' ? 415 : 502
      return fail(res, status, e.code, e.message)
    }
    console.error('fetch failed:', e instanceof Error ? `${e.name}: ${e.message}` : String(e)) // never log the URL
    fail(res, 500, 'SERVER', 'Unexpected server error')
  }
}
