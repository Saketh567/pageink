import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { savedAnnotations } from './idb.ts'

const PAGE_HTML = '<!doctype html><title>Backup Me</title><h1>Backup Me</h1><p>Some words worth keeping safe.</p>'

// Make the download path deterministic: no native share sheet in the test browser
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { value: undefined })
    Object.defineProperty(navigator, 'share', { value: undefined })
  })
})

async function importPage(page: Page) {
  await page.goto('/')
  await page.locator('input[type=file]').setInputFiles({ name: 'backup-me.html', mimeType: 'text/html', buffer: Buffer.from(PAGE_HTML) })
  await expect(page.locator('.stage[data-ready]')).toBeAttached()
}

async function drawOneStroke(page: Page) {
  await page.mouse.move(300, 300)
  await page.mouse.down()
  await page.mouse.move(420, 340, { steps: 8 })
  await page.mouse.up()
  await expect.poll(() => savedAnnotations(page)).toBe(1)
}

async function downloadBackup(page: Page, trigger: () => Promise<void>) {
  const [download] = await Promise.all([page.waitForEvent('download'), trigger()])
  return JSON.parse(readFileSync((await download.path())!, 'utf8')) as { format: string; pages: Array<{ title: string }>; annotations: unknown[]; snapshots: unknown[] }
}

test('back up, delete the page, restore: the page and its marks come back', async ({ page }) => {
  await importPage(page)
  await drawOneStroke(page)
  await page.getByRole('button', { name: 'Back to library' }).click()

  await page.getByRole('button', { name: 'Settings' }).click()
  const backup = await downloadBackup(page, () => page.getByRole('button', { name: 'Back up everything' }).click())
  expect(backup.format).toBe('pageink-backup')
  expect(backup.pages.map((p) => p.title)).toContain('Backup Me')
  expect(backup.annotations.length).toBeGreaterThanOrEqual(1)
  expect(backup.snapshots.length).toBeGreaterThanOrEqual(1)
  await expect(page.getByText('Backup downloaded')).toBeVisible()

  // wipe the page, then restore from the file we just saved
  await page.getByRole('button', { name: '‹ Library' }).click()
  await page.getByRole('button', { name: /Options for Backup Me/ }).click()
  page.once('dialog', (d) => void d.accept())
  await page.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByRole('button', { name: /^Open Backup Me/ })).toHaveCount(0)

  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByLabel('Backup file').setInputFiles({ name: 'restore.pageink.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) })
  await expect(page.getByRole('status').filter({ hasText: 'Restored' })).toBeVisible()

  await page.getByRole('button', { name: '‹ Library' }).click()
  await page.getByRole('button', { name: /^Open Backup Me/ }).click()
  await expect(page.locator('.stage[data-ready]')).toBeAttached()
  await expect(page.locator('svg.viewer-ink g[data-layer=ink] > path')).toHaveCount(1)
})

test('a file that is not a backup is refused and changes nothing', async ({ page }) => {
  await page.goto('/#/settings')
  await page.getByLabel('Backup file').setInputFiles({ name: 'notes.json', mimeType: 'application/json', buffer: Buffer.from('{"hello": "world"}') })
  await expect(page.getByRole('alert')).toContainText('not a PageInk backup')
  await page.getByRole('button', { name: '‹ Library' }).click()
  await expect(page.getByRole('button', { name: /^Open How a web page works/ })).toBeVisible()
})

test('the library reminds you to back up once you have your own pages, and the reminder clears after a backup', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Back up your library')).toHaveCount(0) // only the bundled sample: nothing to lose yet

  await importPage(page)
  await page.getByRole('button', { name: 'Back to library' }).click()
  await expect(page.getByText('Back up your library')).toBeVisible()
  await downloadBackup(page, () => page.getByRole('button', { name: 'Back up now' }).click())
  await expect(page.getByText('Back up your library')).toHaveCount(0)
})

test('the library offers to continue where you left off', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Continue where you left off')).toHaveCount(0)
  await page.getByRole('button', { name: /^Open How a web page works/ }).click()
  await expect(page.locator('.stage[data-ready]')).toBeAttached()
  await page.getByRole('button', { name: 'Back to library' }).click()
  const resume = page.locator('.resume')
  await expect(resume).toContainText('Continue where you left off')
  await expect(resume).toContainText('How a web page works')
  await resume.click()
  await expect(page.locator('.stage[data-ready]')).toBeAttached()
})
