/**
 * Turns a saved page back into something a browser can show: every pk-asset:<hash> token in the stored HTML becomes a short-lived
 * blob: address for the saved file. Done in memory just before the page is shown; the stored page keeps the tokens.
 */

const TOKEN = /pk-asset:([0-9a-f]{64})/g

export interface StoredAsset { type: string; data: ArrayBuffer }

export async function withAssetUrls(
  html: string,
  getAsset: (hash: string) => Promise<StoredAsset | undefined>,
): Promise<{ html: string; revoke(): void }> {
  const hashes = new Set(Array.from(html.matchAll(TOKEN), (m) => m[1]))
  if (!hashes.size) return { html, revoke() {} }
  const urls = new Map<string, string>()
  await Promise.all(Array.from(hashes, async (h) => {
    const a = await getAsset(h)
    if (a) urls.set(h, URL.createObjectURL(new Blob([a.data], { type: a.type })))
  }))
  // a file that went missing shows as an empty picture instead of a broken one
  return { html: html.replace(TOKEN, (_m, h: string) => urls.get(h) ?? 'data:,'), revoke: () => urls.forEach((u) => URL.revokeObjectURL(u)) }
}
