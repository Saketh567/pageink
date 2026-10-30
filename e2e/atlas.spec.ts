import { expect, test, type Page } from '@playwright/test'

// Behaviour: the Atlas desk (src/atlas): posters on an endless desk you can drag, zoom, dive into and add to.
// Related: e2e/library.spec.ts covers the classic shelf (#/shelf), which still works.

const open = async (page: Page, size = { width: 820, height: 1180 }) => {
  await page.setViewportSize(size)
  await page.goto('/#/')
  await expect(page.locator('.atlas')).toBeVisible()
  await expect(page.locator('.card.page').first()).toBeVisible()
}
const sample = (page: Page) => page.locator('[data-card="pc-home-sample"]')
const lod = (page: Page) => sample(page).getAttribute('data-lod')

test('first launch shows the library as posters on a desk, grouped in a frame', async ({ page }) => {
  await open(page)
  await expect(sample(page)).toContainText('How a web page works')
  await expect(page.locator('.frame-label')).toContainText('Loose pages')
  await expect(page.locator('.orb')).toContainText('Home')
  await expect(page.getByRole('textbox', { name: 'Web address' })).toBeVisible()
})

test('dragging a poster moves it, and it stays there after a reload', async ({ page }) => {
  await open(page)
  const before = (await sample(page).boundingBox())!
  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2)
  await page.mouse.down()
  await page.mouse.move(before.x + before.width / 2 + 160, before.y + before.height / 2 + 90, { steps: 8 })
  await page.mouse.up()
  await expect(sample(page)).not.toHaveClass(/lifted/)
  await page.waitForTimeout(300) // the lift animation settles
  const moved = (await sample(page).boundingBox())!
  expect(Math.round(moved.x - before.x)).toBeGreaterThan(100)
  expect(Math.round(moved.y - before.y)).toBeGreaterThan(50)

  await expect.poll(() => page.evaluate(() => new Promise<number>((ok) => {
    const o = indexedDB.open('pageink')
    o.onsuccess = () => { const q = o.result.transaction('cards').objectStore('cards').get('pc-home-sample'); q.onsuccess = () => ok(q.result.x) }
  }))).toBeGreaterThan(0)
  await page.reload()
  await expect(sample(page)).toBeVisible()
  const after = (await sample(page).boundingBox())!
  expect(Math.abs(after.x - moved.x)).toBeLessThan(3) // the camera and the card both came back as left
  expect(Math.abs(after.y - moved.y)).toBeLessThan(3)
})

test('dragging the empty desk pans it, and the wheel zooms from poster down to a dot and back', async ({ page }) => {
  await open(page)
  const a = (await sample(page).boundingBox())!
  await page.mouse.move(700, 900)
  await page.mouse.down()
  await page.mouse.move(600, 820, { steps: 6 })
  await page.waitForTimeout(150) // a deliberate stop: let go while still, so the desk does not glide on
  await page.mouse.up()
  const b = (await sample(page).boundingBox())!
  expect(Math.round(a.x - b.x)).toBe(100) // moved with the finger, one to one
  expect(Math.round(a.y - b.y)).toBe(80)

  const c = (await sample(page).boundingBox())!
  await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2) // zoom around the poster itself, so it stays on screen
  const first = await lod(page)
  const seen = new Set<string>([first!])
  for (let i = 0; i < 14; i++) { await page.mouse.wheel(0, 300); seen.add((await lod(page)) ?? 'gone') }
  await expect.poll(() => lod(page)).toBe('dot')
  for (let i = 0; i < 14; i++) { await page.mouse.wheel(0, -300) } // exactly as far back in as we went out
  await expect.poll(() => lod(page)).toBe(first)
  for (let i = 0; i < 5; i++) { await page.mouse.wheel(0, -300) } // and further in, around the same poster
  await expect.poll(() => lod(page)).toBe('poster')
  expect(seen.has('dot')).toBe(true)
})

test('double-clicking a poster dives into the real page, and Esc rises back to the desk', async ({ page }) => {
  await open(page)
  await sample(page).dblclick()
  await expect(page).toHaveURL(/#\/b\/home\/p\/sample$/)
  await expect(page.locator('.dive .stage[data-ready]')).toBeAttached()
  await expect(page.frameLocator('iframe.viewer-frame').getByRole('heading', { name: /How a web page works/ }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Back to the desk' })).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page).toHaveURL(/#\/b\/home$/)
  await expect(page.locator('.dive')).toHaveCount(0)
  await expect(sample(page)).toBeVisible()
})

test('the rise button also goes back, and the dive can be opened by its address', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 })
  await page.goto('/#/b/home/p/sample')
  await expect(page.locator('.dive .stage[data-ready]')).toBeAttached()
  await page.getByRole('button', { name: 'Back to the desk' }).click()
  await expect(page.locator('.dive')).toHaveCount(0)
  await expect(sample(page)).toBeVisible()
})

test('a pasted link becomes a new poster in the middle of the view', async ({ page }) => {
  await page.route('**/api/fetch', (r) => void r.fulfill({ json: { html: '<!doctype html><title>Fresh arrival</title><body><h1>Hello</h1>' + '<p>Some readable text for the page.</p>'.repeat(10) + '</body>', finalUrl: 'https://new.example/a', status: 200 } }))
  await open(page)
  const before = await page.locator('.card.page').count()
  await page.getByRole('textbox', { name: 'Web address' }).fill('https://new.example/a')
  await page.getByRole('button', { name: 'Add this page' }).click()
  await expect(page.locator('.card.page', { hasText: 'Fresh arrival' })).toBeVisible()
  expect(await page.locator('.card.page').count()).toBe(before + 1)
  const box = (await page.locator('.card.page', { hasText: 'Fresh arrival' }).boundingBox())!
  expect(box.x + box.width / 2).toBeGreaterThan(300) // dropped near the middle of an 820 px screen
  expect(box.x + box.width / 2).toBeLessThan(520)
})

test('the day desk is a switch away, and the choice is remembered', async ({ page }) => {
  await open(page)
  await expect(page.locator('.atlas')).toHaveAttribute('data-world', 'night')
  await page.getByRole('button', { name: 'Switch to day desk' }).click()
  await expect(page.locator('.atlas')).toHaveAttribute('data-world', 'day')
  await page.reload()
  await expect(page.locator('.atlas')).toHaveAttribute('data-world', 'day')
})

test('on a phone the desk and its controls fit the screen', async ({ page }) => {
  await open(page, { width: 390, height: 844 })
  const dock = (await page.locator('.dock').boundingBox())!
  expect(dock.x).toBeGreaterThanOrEqual(0)
  expect(dock.x + dock.width).toBeLessThanOrEqual(390)
  await expect(page.locator('.orb')).toBeVisible()
})

test('the classic shelf is still there, and Back from Settings returns to the desk', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: 'Settings' }).click()
  await expect(page.getByRole('button', { name: '‹ Desk' })).toBeVisible()
  await page.getByRole('button', { name: '‹ Desk' }).click()
  await expect(page.locator('.atlas')).toBeVisible()
  await page.getByRole('button', { name: 'Classic shelf' }).click()
  await expect(page.getByRole('button', { name: /^Open How a web page works/ })).toBeVisible()
})
