import { expect, test, type Page } from '@playwright/test'
import { savedAnnotations, savedView } from './idb.ts'

// The bundled sample page: section 1's first paragraph is "A web page is a conversation between a server, a browser and a person. The server sends text, ..."
const FIRST_SENTENCE = 'A web page is a conversation between a server, a browser and a person.'

async function open(page: Page) {
  await page.goto('/#/p/sample')
  await expect(page.locator('.stage[data-ready]')).toBeAttached()
  await expect(page.locator('.viewer-frame')).toBeVisible()
}

const frame = (page: Page) => page.frameLocator('iframe.viewer-frame')
const paragraph = (page: Page) => frame(page).locator('section#s1 p').first()
const rows = (page: Page) => page.locator('.markrow .quote')

/** Pointer down on the first line of the paragraph, optionally move, hold, release. */
async function markDrag(page: Page, opts: { fromX: number; toX?: number; holdMs?: number }) {
  const box = (await paragraph(page).boundingBox())!
  const y = box.y + 12
  await page.mouse.move(box.x + opts.fromX, y)
  await page.mouse.down()
  if (opts.toX !== undefined) await page.mouse.move(box.x + opts.toX, y, { steps: 8 })
  if (opts.holdMs) await page.waitForTimeout(opts.holdMs)
  await page.mouse.up()
}

async function openPanel(page: Page) {
  await page.getByRole('button', { name: 'Marks' }).click()
  await expect(page.locator('.panel')).toBeVisible()
}

test('Mark tool: a drag selects whole words, and holding grows it to the sentence then the paragraph', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: 'Mark text' }).click()
  const text = (await paragraph(page).textContent())!

  await markDrag(page, { fromX: 30, toX: 120 })
  await expect(page.locator('svg.viewer-ink g[data-layer=highlights] > g')).toHaveCount(1)
  await openPanel(page)
  const words = ((await rows(page).first().textContent()) ?? '').replace(/[“”]/g, '')
  expect(words.length).toBeGreaterThan(3)
  expect(text.includes(words)).toBe(true)
  expect(text.startsWith(words) || /\W/.test(text[text.indexOf(words) - 1])).toBe(true) // starts at a word boundary
  expect(/\W/.test(text[text.indexOf(words) + words.length] ?? ' ')).toBe(true) // ends at a word boundary
  await page.getByRole('button', { name: 'Close marks' }).click()

  await markDrag(page, { fromX: 60, holdMs: 700 }) // hold: sentence
  await openPanel(page)
  await expect(rows(page).filter({ hasText: FIRST_SENTENCE })).toHaveCount(1)
  await page.getByRole('button', { name: 'Close marks' }).click()

  await markDrag(page, { fromX: 60, holdMs: 1400 }) // hold longer: whole paragraph
  await openPanel(page)
  await expect(rows(page).filter({ hasText: 'Contrast decides whether anyone can read it at all' })).toHaveCount(1)
})

test('marks and notes come back after a reload, found again from their words', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: 'Mark text' }).click()
  await page.getByRole('button', { name: 'Meaning Question' }).click()
  await markDrag(page, { fromX: 60, holdMs: 700 })

  await page.getByRole('button', { name: 'Note', exact: true }).click()
  await page.getByRole('button', { name: 'Meaning Idea' }).click()
  const box = (await paragraph(page).boundingBox())!
  await page.mouse.click(box.x + 500, box.y + 12)
  await page.getByLabel('Note text').fill('Remember to compare with the other pages')
  await page.getByRole('button', { name: 'Done' }).click()

  await expect.poll(() => savedAnnotations(page)).toBe(2)
  await page.reload()
  await expect(page.locator('.stage[data-ready]')).toBeAttached()
  await expect(page.locator('svg.viewer-ink g[data-layer=highlights] > g')).toHaveCount(1)
  await expect(page.locator('svg.viewer-ink g.pin')).toHaveCount(1)
  await expect(page.locator('svg.viewer-ink rect[stroke-dasharray]')).toHaveCount(0) // nothing orphaned
  await openPanel(page)
  await expect(page.locator('.markrow', { hasText: 'Remember to compare with the other pages' })).toHaveCount(1)
  await expect(page.locator('.markrow small', { hasText: 'Question' })).toHaveCount(1)
})

test('an empty note is discarded when closed, and a note can be deleted', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: 'Note', exact: true }).click()
  const box = (await paragraph(page).boundingBox())!
  await page.mouse.click(box.x + 200, box.y + 12)
  await expect(page.locator('.notecard')).toBeVisible()
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(page.locator('svg.viewer-ink g.pin')).toHaveCount(0)

  await page.mouse.click(box.x + 200, box.y + 12)
  await page.getByLabel('Note text').fill('keep then delete')
  await page.getByRole('button', { name: 'Delete note' }).click()
  await expect(page.locator('svg.viewer-ink g.pin')).toHaveCount(0)
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.locator('svg.viewer-ink g.pin')).toHaveCount(1) // delete is undoable
})

test('Marks panel: filter by meaning, search, jump, spotlight and delete', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: 'Mark text' }).click()
  await page.getByRole('button', { name: 'Meaning Important' }).click()
  await markDrag(page, { fromX: 40, toX: 90 })
  await page.getByRole('button', { name: 'Meaning Issue' }).click()
  await markDrag(page, { fromX: 200, toX: 260 })
  await openPanel(page)
  await expect(rows(page)).toHaveCount(2)

  await page.getByRole('group', { name: 'Filter by meaning' }).getByRole('button', { name: 'Issue' }).click()
  await expect(rows(page)).toHaveCount(1)
  await page.getByRole('group', { name: 'Filter by meaning' }).getByRole('button', { name: 'All' }).click()
  await page.getByLabel('Search marks').fill('zzzz-no-such-text')
  await expect(page.getByText('Nothing matches')).toBeVisible()
  await page.getByLabel('Search marks').fill('')

  await page.getByRole('button', { name: 'Spotlight this highlight' }).first().click()
  await expect(page.locator('svg.viewer-ink path.spotlight')).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(page.locator('svg.viewer-ink path.spotlight')).toHaveCount(0)

  await page.getByRole('button', { name: 'Delete mark' }).first().click()
  await expect(rows(page)).toHaveCount(1)
})

test('tapping away from the spotlight ends it without starting a new mark', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: 'Mark text' }).click()
  await markDrag(page, { fromX: 40, toX: 90 })
  await openPanel(page)
  await page.getByRole('button', { name: 'Spotlight this highlight' }).click()
  await page.getByRole('button', { name: 'Close marks' }).click()
  await expect(page.locator('svg.viewer-ink path.spotlight')).toHaveCount(1)
  const box = (await paragraph(page).boundingBox())!
  await page.mouse.click(box.x + 300, box.y + 40)
  await expect(page.locator('svg.viewer-ink path.spotlight')).toHaveCount(0)
  await expect(page.locator('svg.viewer-ink g[data-layer=highlights] > g')).toHaveCount(1)
})

test('study sheet is shared as Markdown grouped by meaning', async ({ page }) => {
  await page.addInitScript(() => {
    ;(navigator as unknown as { share: (d: { text: string }) => Promise<void> }).share = async (d) => { (window as unknown as { __shared: string }).__shared = d.text }
  })
  await open(page)
  await page.getByRole('button', { name: 'Mark text' }).click()
  await page.getByRole('button', { name: 'Meaning Important' }).click()
  await markDrag(page, { fromX: 60, holdMs: 700 })
  await openPanel(page)
  await page.getByRole('button', { name: 'Share study sheet' }).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __shared?: string }).__shared ?? '')).toContain('## Important')
  const md = await page.evaluate(() => (window as unknown as { __shared: string }).__shared)
  expect(md).toContain(`> ${FIRST_SENTENCE}`)
  expect(md.startsWith('# How a web page works (sample)')).toBe(true)
})

test('margin lane: handwriting beside the page gets a leader line, and the lane is remembered', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: 'Margin lane' }).click()
  await expect(page.locator('.viewer-lane')).toBeVisible()
  await page.getByRole('button', { name: 'Pen' }).click()
  const lane = (await page.locator('.viewer-lane').boundingBox())!
  const para = (await paragraph(page).boundingBox())!
  const y = para.y + 20
  await page.mouse.move(lane.x + 30, y)
  await page.mouse.down()
  for (let i = 1; i <= 16; i++) await page.mouse.move(lane.x + 30 + i * 8, y + Math.sin(i / 2) * 8)
  await page.mouse.up()
  await expect(page.locator('svg.viewer-ink path[data-leader-for]')).toHaveCount(1)

  await expect.poll(() => savedAnnotations(page)).toBe(1)
  await expect.poll(async () => (await savedView(page, 'sample'))?.margin).toBe(true)
  await page.reload()
  await expect(page.locator('.stage[data-ready]')).toBeAttached()
  await expect(page.locator('.viewer-lane')).toBeVisible()
  await expect(page.locator('svg.viewer-ink path[data-leader-for]')).toHaveCount(1)
})

test('remembers where you were reading', async ({ page }) => {
  await open(page)
  await page.locator('.viewer-scroll').evaluate((el) => { el.scrollTop = 1800 })
  await expect.poll(async () => (await savedView(page, 'sample'))?.scrollTop ?? 0).toBeGreaterThan(1000)
  await page.reload()
  await expect(page.locator('.stage[data-ready]')).toBeAttached()
  await expect.poll(() => page.locator('.viewer-scroll').evaluate((el) => el.scrollTop)).toBeGreaterThan(1000)
})

test('heat strip shows a tick per mark and jumps to it', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: 'Mark text' }).click()
  await markDrag(page, { fromX: 40, toX: 90 })
  await expect(page.locator('.heat .tick')).toHaveCount(1)
  await page.locator('.viewer-scroll').evaluate((el) => { el.scrollTop = 3000 })
  await page.locator('.heat .tick').first().click({ force: true })
  await expect.poll(() => page.locator('.viewer-scroll').evaluate((el) => el.scrollTop)).toBeLessThan(600)
})
