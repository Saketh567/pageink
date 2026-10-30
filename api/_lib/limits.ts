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

/** One fixed window per key (the visitor's address); old windows are dropped so the map cannot grow forever. */
export function createKeyedLimiter(limit: number, windowMs: number, now: () => number = Date.now) {
  const windows = new Map<string, { start: number; count: number }>()
  return (key: string) => {
    const t = now()
    if (windows.size > 2000) for (const [k, w] of windows) if (t - w.start >= windowMs) windows.delete(k)
    const w = windows.get(key)
    if (!w || t - w.start >= windowMs) { windows.set(key, { start: t, count: 1 }); return true }
    return ++w.count <= limit
  }
}

// per visitor, plus a ceiling for the whole instance (shortcut: instances do not share counts)
const fetchEach = createKeyedLimiter(20, 60_000)
const fetchAll = createLimiter(150, 60_000)
const renderEach = createKeyedLimiter(5, 60_000)
const renderAll = createLimiter(20, 60_000)
export const fetchLimiter = (ip: string) => fetchEach(ip) && fetchAll()
export const renderLimiter = (ip: string) => renderEach(ip) && renderAll()
