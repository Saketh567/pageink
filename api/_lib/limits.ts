/** shortcut: per-instance fixed window, so each warm function instance counts separately; upgrade to Upstash Ratelimit if abused. */
export function createLimiter(limit: number, windowMs: number, now: () => number = Date.now) {
  let start = now()
  let count = 0
  return () => {
    const t = now()
    if (t - start >= windowMs) { start = t; count = 0 }
    return ++count <= limit
  }
}

export const fetchLimiter = createLimiter(30, 60_000)
export const renderLimiter = createLimiter(6, 60_000)
export const explainLimiter = createLimiter(20, 24 * 3_600_000)
