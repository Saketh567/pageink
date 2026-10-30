import http from 'node:http'
import net from 'node:net'
import { describe, expect, test } from 'vitest'
import { pinHost, startPinProxy } from '../api/_lib/pin-proxy.ts'

const to = (address: string) => async () => [{ address, family: address.includes(':') ? 6 : 4 }]

describe('pinHost: which address may be connected to', () => {
  test('a public address on 80 or 443 is pinned to the address that was checked', async () => {
    expect(await pinHost('shop.example', 443, to('93.184.216.34'))).toEqual({ address: '93.184.216.34', family: 4 })
    expect(await pinHost('shop.example', 80, to('93.184.216.34'))).not.toBeNull()
  })

  test.each(['127.0.0.1', '10.1.2.3', '169.254.169.254', '192.168.0.5', '::1', '::ffff:127.0.0.1'])('a host that resolves to %s is refused', async (ip) => {
    expect(await pinHost('rebind.example', 443, to(ip))).toBeNull()
  })

  test('one private address among public ones refuses the host', async () => {
    const mixed = async () => [{ address: '93.184.216.34', family: 4 }, { address: '10.0.0.1', family: 4 }]
    expect(await pinHost('mixed.example', 443, mixed)).toBeNull()
  })

  test('other ports, literal addresses, credentials and unresolvable hosts are refused', async () => {
    expect(await pinHost('shop.example', 22, to('93.184.216.34'))).toBeNull()
    expect(await pinHost('shop.example', 8080, to('93.184.216.34'))).toBeNull()
    expect(await pinHost('127.0.0.1', 443, to('93.184.216.34'))).toBeNull()
    expect(await pinHost('user@shop.example', 443, to('93.184.216.34'))).toBeNull()
    expect(await pinHost('gone.example', 443, async () => { throw new Error('ENOTFOUND') })).toBeNull()
  })
})

describe('the proxy itself', () => {
  async function through(method: 'CONNECT' | 'GET', target: string, resolve: Parameters<typeof startPinProxy>[0]) {
    const proxy = await startPinProxy(resolve)
    try {
      if (method === 'GET') {
        return await new Promise<number>((ok) => {
          const r = http.request({ host: '127.0.0.1', port: proxy.port, path: target, method: 'GET' }, (res) => { res.resume(); ok(res.statusCode ?? 0) })
          r.on('error', () => ok(0))
          r.end()
        })
      }
      return await new Promise<string>((ok) => {
        const sock = net.connect(proxy.port, '127.0.0.1', () => sock.write(`CONNECT ${target} HTTP/1.1\r\nHost: ${target}\r\n\r\n`))
        let buf = ''
        sock.on('data', (d) => { buf += d.toString(); if (buf.includes('\r\n')) { sock.destroy(); ok(buf.split('\r\n')[0]) } })
        sock.on('error', () => ok('error'))
      })
    } finally {
      await proxy.close()
    }
  }

  test('a tunnel to a host that resolves to an internal address is refused with 403', async () => {
    expect(await through('CONNECT', 'rebind.example:443', to('169.254.169.254'))).toBe('HTTP/1.1 403 Forbidden')
  })

  test('a tunnel to a non-web port is refused', async () => {
    expect(await through('CONNECT', 'shop.example:22', to('93.184.216.34'))).toBe('HTTP/1.1 403 Forbidden')
  })

  test('a plain request to an internal address is refused with 403', async () => {
    expect(await through('GET', 'http://rebind.example/secret', to('127.0.0.1'))).toBe(403)
  })

  test('a request that is not an absolute address is refused', async () => {
    expect(await through('GET', '/just/a/path', to('93.184.216.34'))).toBe(403)
  })
})
