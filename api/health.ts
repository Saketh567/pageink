import type { VercelRequest, VercelResponse } from '@vercel/node'

/** Which build is live (the commit is public anyway: the repository is). Says nothing about configuration or keys. */
export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  res.json({
    ok: true,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
  })
}
