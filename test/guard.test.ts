import { describe, expect, test } from 'vitest'
import { isPrivateIp, validateTarget } from '../api/_lib/guard.ts'

describe('validateTarget', () => {
  test.each([
    'https://example.com', 'http://example.com/path?q=1', 'https://sub.example.co.uk:443/', 'http://example.com:80',
  ])('allows %s', (u) => expect(validateTarget(u).ok).toBe(true))

  test.each([
    'ftp://example.com', 'file:///etc/passwd', 'javascript:alert(1)', 'data:text/html,hi', 'not a url', '',
    'https://user:pw@example.com', 'https://user@example.com',
  ])('rejects as BAD_URL: %s', (u) => expect(validateTarget(u)).toEqual({ ok: false, code: 'BAD_URL' }))

  test.each([
    'http://127.0.0.1', 'http://127.1', 'http://2130706433', 'http://0x7f.1', 'http://0177.0.0.1', 'http://[::1]',
    'http://[::ffff:127.0.0.1]', 'http://10.0.0.5', 'http://192.168.1.1', 'http://169.254.169.254/latest/meta-data',
    'http://localhost', 'http://foo.localhost', 'http://printer.local', 'http://metadata.google.internal',
    'http://router.home.arpa', 'http://intranet', 'https://example.com:8443', 'http://example.com:22', 'http://localhost.',
  ])('rejects as BLOCKED_HOST: %s', (u) => expect(validateTarget(u)).toEqual({ ok: false, code: 'BLOCKED_HOST' }))
})

describe('isPrivateIp', () => {
  test.each([
    '0.0.0.0', '10.1.2.3', '100.64.0.1', '100.127.255.255', '127.0.0.1', '169.254.1.1', '172.16.0.1', '172.31.255.255',
    '192.0.0.1', '192.168.0.1', '198.18.0.1', '198.19.1.1', '224.0.0.1', '255.255.255.255',
    '::', '::1', 'fc00::1', 'fd12:3456::1', 'fe80::1', 'febf::1', 'ff02::1', '::ffff:10.0.0.1', '::ffff:7f00:1', 'garbage',
  ])('private: %s', (ip) => expect(isPrivateIp(ip)).toBe(true))

  test.each([
    '8.8.8.8', '93.184.216.34', '100.63.255.255', '172.15.0.1', '172.32.0.1', '192.0.1.1', '198.17.0.1', '223.255.255.255',
    '2606:4700:4700::1111', '2001:db8::1', '::ffff:8.8.8.8',
  ])('public: %s', (ip) => expect(isPrivateIp(ip)).toBe(false))
})
