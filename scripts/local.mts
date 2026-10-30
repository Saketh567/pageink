// Runs the built app the way Vercel serves it: same security headers, and the real /api handlers.
// Usage: npm run local   (builds first), then open http://localhost:4488 and use the key printed below.
import { existsSync, readFileSync, statSync } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { extname, join, normalize } from 'node:path'

process.env.APP_KEY ??= 'local-dev-key'
const PORT = Number(process.env.PORT ?? 4488)
const DIST = 'dist'

const headers: Record<string, string> = {}
for (const h of JSON.parse(readFileSync('vercel.json', 'utf8')).headers[0].headers) headers[h.key] = h.value

const MIME: Record<string, string> = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.ico': 'image/x-icon',
}

const routes: Record<string, () => Promise<{ default: (req: never, res: never) => unknown }>> = {
  '/api/fetch': () => import('../api/fetch.ts'),
  '/api/render': () => import('../api/render.ts'),
  '/api/asset': () => import('../api/asset.ts'),
  '/api/health': () => import('../api/health.ts'),
}

async function body(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const c of req) chunks.push(c as Buffer)
  try { return JSON.parse(Buffer.concat(chunks).toString() || '{}') } catch { return {} }
}

/** Gives a plain Node response the res.status().json() shape the Vercel handlers expect. */
function vercelRes(res: ServerResponse) {
  const r = res as ServerResponse & { status(c: number): typeof r; json(b: unknown): void }
  r.status = (c) => { res.statusCode = c; return r }
  r.json = (b) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(b)) }
  return r
}

createServer(async (req, res) => {
  const path = (req.url ?? '/').split('?')[0]
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v)

  if (routes[path]) {
    try {
      const { default: handler } = await routes[path]()
      Object.assign(req, { body: await body(req) })
      await (handler as (a: unknown, b: unknown) => unknown)(req, vercelRes(res))
    } catch (e) {
      console.error(path, e instanceof Error ? e.message : e)
      if (!res.headersSent) { res.statusCode = 500; res.end('{"error":"SERVER"}') }
    }
    return
  }

  let file = join(DIST, normalize(decodeURIComponent(path)).replace(/^([/\\])+/, ''))
  if (!file.startsWith(DIST) || !existsSync(file) || statSync(file).isDirectory()) file = join(DIST, 'index.html')
  res.setHeader('content-type', MIME[extname(file)] ?? 'application/octet-stream')
  res.end(readFileSync(file))
}).listen(PORT, () => console.log(`PageInk running at http://localhost:${PORT}\nPersonal key for Settings: ${process.env.APP_KEY}`))
