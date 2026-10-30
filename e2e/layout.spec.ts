import { expect, test, type Page } from '@playwright/test'

const IPAD_PORTRAIT = { width: 820, height: 1180 }
const IPAD_LANDSCAPE = { width: 1180, height: 820 }

const frameWidth = (page: Page) => page.locator('iframe.viewer-frame').evaluate((f) => f.getBoundingClientRect().width)
const scaleOf = (page: Page) => page.locator('.viewer-wrapper').evaluate((w) => Number(w.style.transform.replace(/[^0-9.]/g, '')))
const paragraph = (page: Page) => page.frameLocator('iframe.viewer-frame').locator('section#s1 p').first()

async function open(page: Page, size = IPAD_PORTRAIT) {
  await page.setViewportSize(size)
  await page.goto('/#/p/sample')
  await expect(page.locator('.stage[data-ready]')).toBeAttached()
}

test('Auto layout fits the screen at true size, in portrait and landscape', async ({ page }) => {
  await open(page, IPAD_PORTRAIT)
  expect(await frameWidth(page)).toBeGreaterThan(780) // the page is laid out at the iPad's width, not shrunk from 1280
  expect(await frameWidth(page)).toBeLessThanOrEqual(820)
  expect(await scaleOf(page)).toBe(1)

  await page.setViewportSize(IPAD_LANDSCAPE) // rotate
  await expect.poll(() => frameWidth(page)).toBeGreaterThan(1130)
  expect(await scaleOf(page)).toBe(1)

  await page.setViewportSize({ width: 744, height: 1133 }) // iPad mini portrait
  await expect.poll(() => frameWidth(page)).toBeLessThan(745)
  await page.setViewportSize({ width: 390, height: 844 }) // phone-sized window
  await expect.poll(() => frameWidth(page)).toBeLessThan(391)
  expect(await scaleOf(page)).toBe(1)
})

test('the page really re-flows: a narrower layout makes it taller', async ({ page }) => {
  const text = 'A paragraph that is long enough to wrap onto several lines when the screen is narrow. '.repeat(6)
  const body = Array.from({ length: 12 }, () => `<p style="margin:0 0 16px;font:18px/1.5 Georgia">${text}</p>`).join('')
  await page.setViewportSize(IPAD_LANDSCAPE)
  await page.goto('/')
  await page.locator('input[type=file]').setInputFiles({ name: 'flow.html', mimeType: 'text/html', buffer: Buffer.from(`<!doctype html><title>Flow</title><body style="margin:0">${body}</body>`) })
  await expect(page.locator('.stage[data-ready]')).toBeAttached()
  const height = async () => Number(await page.locator('svg.viewer-ink').getAttribute('height'))
  const wide = await height()
  await page.setViewportSize(IPAD_PORTRAIT)
  await expect.poll(height).toBeGreaterThan(wide)
  const narrow = await height()
  await page.setViewportSize(IPAD_LANDSCAPE) // rotating back restores the original layout
  await expect.poll(height).toBeLessThan(narrow)
})

test('highlights stay on their words when the screen rotates', async ({ page }) => {
  await open(page, IPAD_LANDSCAPE)
  await page.getByRole('button', { name: 'Mark text' }).click()
  const box = (await paragraph(page).boundingBox())!
  await page.mouse.move(box.x + 60, box.y + 12)
  await page.mouse.down()
  await page.waitForTimeout(700) // hold: the whole first sentence
  await page.mouse.up()
  await expect(page.locator('svg.viewer-ink g[data-layer=highlights] > g')).toHaveCount(1)

  await page.setViewportSize(IPAD_PORTRAIT)
  await expect.poll(() => frameWidth(page)).toBeLessThan(821)
  const inside = async () => {
    const hl = (await page.locator('svg.viewer-ink g[data-layer=highlights] rect').first().boundingBox())!
    const p = (await paragraph(page).boundingBox())!
    return hl.y >= p.y - 2 && hl.y <= p.y + p.height && hl.x >= p.x - 2 && hl.x <= p.x + p.width
  }
  await expect.poll(inside).toBe(true)
})

test('handwriting follows its paragraph when the screen rotates', async ({ page }) => {
  await open(page, IPAD_LANDSCAPE)
  const box = (await paragraph(page).boundingBox())!
  await page.mouse.move(box.x + 100, box.y + 30)
  await page.mouse.down()
  await page.mouse.move(box.x + 300, box.y + 40, { steps: 8 })
  await page.mouse.up()
  await expect(page.locator('svg.viewer-ink g[data-layer=ink] > path')).toHaveCount(1)

  await page.setViewportSize(IPAD_PORTRAIT)
  await expect.poll(() => frameWidth(page)).toBeLessThan(821)
  const stillOnParagraph = async () => {
    const ink = (await page.locator('svg.viewer-ink g[data-layer=ink] > path').boundingBox())!
    const p = (await paragraph(page).boundingBox())!
    const cy = ink.y + ink.height / 2
    return cy >= p.y - 10 && cy <= p.y + p.height + 10 // still on the paragraph it was drawn on, not left behind at the old position
  }
  await expect.poll(stillOnParagraph).toBe(true)
  await page.setViewportSize(IPAD_LANDSCAPE) // and back again
  await expect.poll(() => frameWidth(page)).toBeGreaterThan(1130)
  await expect.poll(stillOnParagraph).toBe(true)
})

test('images load as you get near them, not all at once', async ({ page }) => {
  const requested = new Set<string>()
  await page.route('**/lazy/*.png', (route) => {
    requested.add(route.request().url())
    // a 1x1 transparent PNG
    return route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64') })
  })
  const imgs = Array.from({ length: 40 }, (_, i) => `<p>Section ${i}</p><img src="/lazy/${i}.png" width="600" height="500" alt="">`).join('')
  await page.setViewportSize(IPAD_PORTRAIT)
  await page.goto('/')
  await page.locator('input[type=file]').setInputFiles({ name: 'long.html', mimeType: 'text/html', buffer: Buffer.from(`<!doctype html><title>Long</title><body>${imgs}</body>`) })
  await expect(page.locator('.stage[data-ready]')).toBeAttached()
  const has = (n: number) => [...requested].some((u) => u.endsWith(`/lazy/${n}.png`))
  await expect.poll(() => has(0)).toBe(true) // the images at the top are fetched ...
  await page.waitForTimeout(500) // (give any wrongly eager loading time to show itself)
  expect(requested.size).toBeLessThan(20) // ... but of 40 images only those near the screen were
  expect(has(39)).toBe(false)
  await page.locator('.viewer-scroll').evaluate((el) => { el.scrollTop = el.scrollHeight }) // jump to the bottom
  await expect.poll(() => has(39), { timeout: 15000 }).toBe(true)
  expect(has(20)).toBe(false) // the middle was skipped over, so it was never fetched
})

test('each page can be switched from Auto to a fixed width', async ({ page }) => {
  await page.setViewportSize(IPAD_LANDSCAPE)
  await page.goto('/')
  await page.getByRole('button', { name: /Options for How a web page works/ }).click()
  await page.getByRole('dialog', { name: 'Page options' }).getByLabel('Layout').selectOption('390')
  await page.getByRole('button', { name: 'Done' }).click()
  await page.getByRole('button', { name: /^Open How a web page works/ }).click()
  await expect(page.locator('.stage[data-ready]')).toBeAttached()
  expect(await page.locator('iframe.viewer-frame').evaluate((f) => f.style.width)).toBe('390px') // laid out at 390 ...
  expect(await scaleOf(page)).toBeGreaterThan(1)
})
