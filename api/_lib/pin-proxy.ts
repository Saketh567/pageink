/**
 * A tiny forward proxy that the headless browser is forced through while rendering. It resolves every host itself, refuses
 * anything that is not a public address on port 80 or 443, and connects to the address it checked. The browser never does its own
 * DNS, so a hostile DNS server cannot answer "public" to our check and "internal" to the browser (DNS rebinding), and this covers
 * redirects, subresources and workers alike.
 */
import http from 'node:http'
import net from 'node:net'
import type { Duplex } from 'node:stream'
import { lookup as dnsLookup } from 'node:dns/promises'
import { isPrivateIp, validateTarget } from './guard.ts'

export type Resolve = (host: string) => Promise<Array<{ address: string; family: number }>>

const defaultResolve: Resolve = (h) => dnsLookup(h, { all: true })
const CONNECT_TIMEOUT_MS = 15_000

/** The one validated address to connect to for `host`, or null when the host must not be reached. */
export async function pinHost(host: string, port: number, resolve: Resolve = defaultResolve): Promise<{ address: string; family: number } | null> {
  if (port !== 80 && port !== 443) return null
  const v = validateTarget(`${port === 443 ? 'https' : 'http'}://${host}/`)
  if (!v.ok) return null
  try {
    const addrs = await resolve(v.url.hostname)
    if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) return null
    return addrs[0]
  } catch {
    return null // unresolvable host
  }
}

const deny = (res: http.ServerResponse | Duplex) => {
  if (res instanceof http.ServerResponse) res.writeHead(403).end()
  else res.end('HTTP/1.1 403 Forbidden\r\n\r\n')
}

export async function startPinProxy(resolve: Resolve = defaultResolve): Promise<{ port: number; close(): Promise<void> }> {
  const server = http.createServer((req, res) => {
    void (async () => {
      let u: URL
      try { u = new URL(req.url ?? '') } catch { return deny(res) }
      if (u.protocol !== 'http:') return deny(res)
      const to = await pinHost(u.hostname, Number(u.port || 80), resolve)
      if (!to) return deny(res)
      const up = http.request({ host: to.address, family: to.family, port: Number(u.port || 80), path: u.pathname + u.search, method: req.method, headers: { ...req.headers, host: u.host } }, (r) => {
        res.writeHead(r.statusCode ?? 502, r.headers)
        r.pipe(res)
      })
      up.setTimeout(CONNECT_TIMEOUT_MS, () => up.destroy())
      up.on('error', () => deny(res))
      req.pipe(up)
    })()
  })

  // HTTPS: the browser asks for a tunnel to host:443, we open it to the address we validated
  server.on('connect', (req, client, head) => {
    void (async () => {
      const [host, p] = (req.url ?? '').split(':')
      const to = await pinHost(host, Number(p), resolve)
      if (!to) return deny(client)
      const up = net.connect({ host: to.address, family: to.family, port: Number(p) }, () => {
        client.write('HTTP/1.1 200 Connection Established\r\n\r\n')
        up.write(head)
        up.pipe(client)
        client.pipe(up)
      })
      up.setTimeout(CONNECT_TIMEOUT_MS, () => up.destroy())
      up.on('error', () => client.destroy())
      client.on('error', () => up.destroy())
      client.on('close', () => up.destroy())
    })()
  })

  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok))
  return { port: (server.address() as net.AddressInfo).port, close: () => new Promise((ok) => { server.closeAllConnections(); server.close(() => ok()) }) }
}
