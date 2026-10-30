import { expect, test, type Page } from '@playwright/test'

const FAQ = `<!doctype html><title>FAQ page</title><body style="margin:0;font:18px Georgia">
<h1>Help centre</h1>
<details><summary>What is a details block?</summary><p id="d-ans">Native answer text.</p></details>
<button id="q" aria-expanded="false" aria-controls="a1" style="display:block;font:inherit">How do refunds work?</button>
<div id="a1" hidden><p>Refunds arrive in five days.</p></div>
<div style="opacity:0;transform:translateY(30px)"><p>This paragraph fades in on scroll in the original.</p></div>
<p><a href="https://example.org/other">External link</a></p></body>`

async function openFaq(page: Page) {
  await page.setViewportSize({ width: 820, height: 1180 })
  await page.goto('/')
  await page.locator('input[type=file]').setInputFiles({ name: 'faq.html', mimeType: 'text/html', buffer: Buffer.from(FAQ) })
  await expect(page.locator('.stage[data-ready]')).toBeAttached()
}
const reading = (page: Page) => page.getByRole('button', { name: /tap for reading mode/ }).click()
const frame = (page: Page) => page.frameLocator('iframe.viewer-frame')

test('text that fades in on scroll is visible straight away', async ({ page }) => {
  await openFaq(page)
  await expect(frame(page).getByText('fades in on scroll')).toBeVisible()
  expect(await frame(page).getByText('fades in on scroll').evaluate((e) => getComputedStyle(e.parentElement!).opacity)).toBe('1')
})

test('Expand all opens every dropdown and FAQ at once', async ({ page }) => {
  await openFaq(page)
  await expect(frame(page).getByText('Refunds arrive')).toBeHidden()
  await page.getByRole('button', { name: 'Expand all sections' }).click()
  await expect(frame(page).getByText('Refunds arrive')).toBeVisible()
  await expect(frame(page).getByText('Native answer text.')).toBeVisible()
  await expect(page.getByText(/Opened \d+ hidden section/)).toBeVisible()
})

test('tapping a FAQ header in Read mode opens its answer', async ({ page }) => {
  await openFaq(page)
  await reading(page)
  const box = await frame(page).locator('#q').boundingBox()
  await page.mouse.click(box!.x + 20, box!.y + 10)
  await expect(frame(page).getByText('Refunds arrive')).toBeVisible()
})

test('a link to another site asks first', async ({ page }) => {
  await openFaq(page)
  await reading(page)
  const link = await frame(page).getByRole('link', { name: 'External link' }).boundingBox()
  await page.mouse.click(link!.x + 10, link!.y + 8)
  await expect(page.getByRole('dialog', { name: 'Link' })).toBeVisible()
})

const SITE = 'https://shop.example'
const pageHtml = (title: string, extra: string) => `<!doctype html><title>${title}</title><body style="margin:0;font:20px Georgia">
<h1>${title}</h1>${extra}<p id="para" style="margin:24px 0">The warranty covers manufacturing defects for two full years from the date of purchase.</p>
<details><summary>Can I return it?</summary><p>Returns are accepted within thirty days.</p></details>
${'<p style="margin:0 0 12px">Filler paragraph so the page is long enough to scroll through properly.</p>'.repeat(30)}</body>`
const SITE_PAGES: Record<string, string> = {
  [`${SITE}/a`]: pageHtml('Shop A', `<p><a href="${SITE}/b">Go to page B</a></p>`),
  [`${SITE}/b`]: pageHtml('Shop B', `<p><a href="${SITE}/a">Back to A</a></p>`),
}

test('marks stay on each page of a site while you move between its pages', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 })
  await page.route('**/api/fetch', async (route) => {
    const { url } = route.request().postDataJSON()
    const html = SITE_PAGES[url.replace(/\/$/, '')]
    await route.fulfill(html ? { json: { html, finalUrl: url, status: 200 } } : { status: 404, json: { error: 'UPSTREAM_404' } })
  })
  const para = () => frame(page).locator('#para')
  const markFirstWords = async () => {
    await page.getByRole('button', { name: 'Mark text' }).click()
    const box = (await para().boundingBox())!
    await page.mouse.move(box.x + 30, box.y + 12)
    await page.mouse.down()
    await page.mouse.move(box.x + 120, box.y + 12, { steps: 8 })
    await page.mouse.up()
    await expect(page.locator('svg.viewer-ink g[data-layer=highlights] > g')).toHaveCount(1)
  }

  await page.goto('/')
  await page.getByRole('textbox', { name: 'Web address' }).fill(`${SITE}/a`)
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await expect(page.locator('.stage[data-ready]')).toBeAttached()
  await page.locator('.viewer-scroll').evaluate((el) => { el.scrollTop = 100 })
  await markFirstWords()

  // read the FAQ on A, then follow a link to B (same site: opens straight away)
  await reading(page)
  const q = await frame(page).locator('summary').boundingBox()
  await page.mouse.click(q!.x + 30, q!.y + 10)
  await expect(frame(page).getByText('Returns are accepted')).toBeVisible()
  const link = await frame(page).getByRole('link', { name: 'Go to page B' }).boundingBox()
  await page.mouse.click(link!.x + 10, link!.y + 8)
  await expect(frame(page).getByRole('heading', { name: 'Shop B' })).toBeVisible()
  await expect(page.locator('svg.viewer-ink g[data-layer=highlights] > g')).toHaveCount(0) // B has no marks yet

  await page.locator('.viewer-scroll').evaluate((el) => { el.scrollTop = 100 })
  await page.getByRole('button', { name: /tap for markup mode/ }).click()
  await markFirstWords()

  // back to A: its mark is still there, and B's is not shown on it
  await page.getByRole('button', { name: 'Back to Shop A' }).click()
  await expect(frame(page).getByRole('heading', { name: 'Shop A' })).toBeVisible()
  await expect(page.locator('svg.viewer-ink g[data-layer=highlights] > g')).toHaveCount(1)

  // and it survives a reload
  await page.reload()
  await expect(page.locator('.stage[data-ready]')).toBeAttached()
  await expect(page.locator('svg.viewer-ink g[data-layer=highlights] > g')).toHaveCount(1)
})

test.describe('a finger always browses, even in Mark mode', () => {
  test.use({ hasTouch: true })

  test('tapping a FAQ question and a link works without switching to Read mode', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'Playwright WebKit touch taps send no pointer events (a real iPad does); covered by docs/IPAD-CHECKLIST.md')
    await openFaq(page) // starts in Mark mode
    await expect(page.getByRole('button', { name: /tap for reading mode/ })).toBeVisible()
    const q = await frame(page).locator('#q').boundingBox()
    await page.touchscreen.tap(q!.x + 20, q!.y + 10)
    await expect(frame(page).getByText('Refunds arrive')).toBeVisible()
    const link = await frame(page).getByRole('link', { name: 'External link' }).boundingBox()
    await page.touchscreen.tap(link!.x + 10, link!.y + 8)
    await expect(page.getByRole('dialog', { name: 'Link' })).toBeVisible()
  })
})
