import { expect, test, type Page } from '@playwright/test'

const paths = (page: Page) => page.locator('svg.viewer-ink g[data-layer=ink] path')

async function swipe(page: Page, x: number, y: number) {
  await page.mouse.move(x, y)
  await page.mouse.down()
  for (let i = 1; i <= 12; i++) await page.mouse.move(x + i * 15, y + Math.sin(i / 2) * 20)
  await page.mouse.up()
}

test('sample page fits the width and is tall', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('iframe.viewer-frame')).toBeVisible()
  const m = await page.evaluate(() => {
    const c = document.querySelector('.viewer-scroll') as HTMLElement
    return { overflowX: c.scrollWidth - c.clientWidth, h: (document.querySelector('.viewer-ink') as SVGElement).getAttribute('height') }
  })
  expect(m.overflowX).toBeLessThanOrEqual(1)
  expect(Number(m.h)).toBeGreaterThan(3000)
})

test('draw, undo, redo, erase and persist across reload', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('iframe.viewer-frame')).toBeVisible()
  await swipe(page, 200, 200)
  await expect(paths(page)).toHaveCount(1)

  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(paths(page)).toHaveCount(0)
  await page.getByRole('button', { name: 'Redo' }).click()
  await expect(paths(page)).toHaveCount(1)

  await page.waitForTimeout(500) // autosave debounce
  await page.reload()
  await expect(paths(page)).toHaveCount(1)

  await page.getByRole('button', { name: 'Eraser' }).click()
  await page.mouse.move(180, 200)
  await page.mouse.down()
  await page.mouse.move(420, 200, { steps: 10 })
  await page.mouse.up()
  await expect(paths(page)).toHaveCount(0)
})

test('reading mode does not draw', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('iframe.viewer-frame')).toBeVisible()
  await page.getByRole('button', { name: /^Markup mode/ }).click()
  await swipe(page, 200, 200)
  await expect(paths(page)).toHaveCount(0)
})
