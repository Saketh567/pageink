import { expect, test, type Page } from '@playwright/test'

// Behaviour: a page's pictures and styles are saved with it after import, so it still looks right with the network gone, and a
// failure to save them is quiet. Related: test/archive.test.ts covers the saving itself; e2e/site.spec.ts covers import flows.

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC', 'base64')
const PAGE_URL = 'https://shop.example/product'
const HTML = `<!doctype html><title>Shoe shop</title><link rel="stylesheet" href="https://css.example/s.css">
<body><h1 class="hero">Air Runner</h1><img id="pic" src="https://img.example/a.png" width="100" height="100"><p>Offline test page with some words to read.</p></body>`

/** The server answers for the page, its stylesheet and its picture. */
async function mockSite(page: Page, assetStatus = 200) {
  await page.route('**/api/fetch', (r) => void r.fulfill({ json: { html: HTML, finalUrl: PAGE_URL, status: 200 } }))
  await page.route('**/api/asset', (r) => {
    if (assetStatus !== 200) return void r.fulfill({ status: assetStatus, json: { error: 'SERVER' } })
    const { url } = r.request().postDataJSON() as { url: string }
    if (url.endsWith('.css')) return void r.fulfill({ body: '.hero{color:rgb(1,2,3)} body{background:rgb(250,240,230)}', contentType: 'text/css' })
    return void r.fulfill({ body: PNG, contentType: 'image/png' })
  })
}

const archiveState = (page: Page) =>
  page.evaluate(() => new Promise<string | null>((ok) => {
    const open = indexedDB.open('pageink')
    open.onsuccess = () => {
      const q = open.result.transaction('pages').objectStore('pages').getAll()
      q.onsuccess = () => ok((q.result as Array<{ url: string; offline?: string }>).find((p) => p.url === 'https://shop.example/product')?.offline ?? null)
    }
  }))

async function importShop(page: Page) {
  await page.setViewportSize({ width: 820, height: 1180 })
  await page.goto('/')
  await page.getByRole('textbox', { name: 'Web address' }).fill(PAGE_URL)
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await expect(page.locator('.stage[data-ready]')).toBeAttached()
}

test('after saving, the page keeps its picture and styling with the network gone', async ({ page, context }) => {
  await mockSite(page)
  await importShop(page)
  await expect.poll(() => archiveState(page)).toBe('complete')

  // the picture's site and the whole server go away
  await page.route('https://img.example/**', (r) => void r.abort())
  await page.route('https://css.example/**', (r) => void r.abort())
  await page.route('**/api/**', (r) => void r.abort())
  await context.setOffline(true)

  await page.evaluate(() => { location.hash = '#/' }) // back to the library, then open the page again from the device
  await expect(page.getByText('Saved offline')).toBeVisible()
  await page.getByRole('button', { name: 'Open Shoe shop' }).click()
  await expect(page.locator('.stage[data-ready]')).toBeAttached()

  const f = page.frameLocator('iframe.viewer-frame')
  await expect.poll(() => f.locator('#pic').evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true)
  expect(await f.locator('.hero').evaluate((e) => getComputedStyle(e).color)).toBe('rgb(1, 2, 3)') // the stylesheet applies
  expect(await f.locator('#pic').evaluate((i: HTMLImageElement) => i.currentSrc.startsWith('blob:'))).toBe(true) // from the device, not the site
})

test('if saving fails the page still opens and says it is only partly saved', async ({ page }) => {
  await mockSite(page, 500)
  await importShop(page)
  await expect.poll(() => archiveState(page)).toBe('partial')
  await expect(page.frameLocator('iframe.viewer-frame').getByRole('heading', { name: 'Air Runner' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Try saving this page for offline again' })).toBeVisible()

  await page.evaluate(() => { location.hash = '#/' })
  await expect(page.getByText('Partly offline')).toBeVisible()
})
