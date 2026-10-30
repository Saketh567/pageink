import type { VercelRequest, VercelResponse } from '@vercel/node'

/** Tells you which build is live and whether APP_KEY is set, without revealing the key. */
export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  res.json({
    ok: true,
    keyConfigured: !!process.env.APP_KEY?.trim(),
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
  })
}
