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
