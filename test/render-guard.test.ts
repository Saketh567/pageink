import { expect, test } from 'vitest'
import { createRequestGuard } from '../api/_lib/render-guard.ts'

const lookup = async (h: string) => [{ address: h === 'internal.example.com' ? '10.0.0.5' : '93.184.216.34' }]

test('allows public hosts, blocks private ones and local literals', async () => {
  const ok = createRequestGuard(lookup)
  expect(await ok('https://cdn.example.com/a.css', 'stylesheet')).toBe(true)
  expect(await ok('https://internal.example.com/a.png', 'image')).toBe(false)
  expect(await ok('http://127.0.0.1/x.png', 'image')).toBe(false)
  expect(await ok('http://localhost:3000/', 'xhr')).toBe(false)
  expect(await ok('http://169.254.169.254/latest', 'fetch')).toBe(false)
})

test('blocks media, websocket, eventsource and ping types even for public hosts', async () => {
  const ok = createRequestGuard(lookup)
  for (const t of ['media', 'websocket', 'eventsource', 'ping']) expect(await ok('https://cdn.example.com/x', t)).toBe(false)
})

test('caches lookups per host for 60 seconds', async () => {
  let t = 0
  let calls = 0
  const ok = createRequestGuard(async () => (calls++, [{ address: '93.184.216.34' }]), () => t)
  await ok('https://a.example.com/1', 'image')
  await ok('https://a.example.com/2', 'image')
  expect(calls).toBe(1)
  t = 61_000
  await ok('https://a.example.com/3', 'image')
  expect(calls).toBe(2)
})

test('treats an unresolvable host as blocked', async () => {
  const ok = createRequestGuard(async () => { throw new Error('ENOTFOUND') })
  expect(await ok('https://nope.example.com/', 'image')).toBe(false)
})
