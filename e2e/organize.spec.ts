import { expect, test, type Page } from '@playwright/test'

const PAGES: Record<string, string> = {
  'alpha.example': 'Alpha Guide',
  'beta.example': 'Beta Notes',
  'gamma.example': 'Gamma Docs',
}

async function seed(page: Page) {
  await page.route('**/api/fetch', (r) => {
    const u = JSON.parse(r.request().postData() ?? '{}').url as string
    const host = Object.keys(PAGES).find((h) => u.includes(h)) ?? 'alpha.example'
    const html = `<!doctype html><title>${PAGES[host]}</title><h1>${PAGES[host]}</h1>${'<p>Readable text so this counts as a content page. </p>'.repeat(12)}`
    r.fulfill({ json: { html, finalUrl: `https://${host}/`, status: 200 } })
  })
  await page.goto('/#/settings')
  await page.getByLabel('Personal key').fill('k')
  await page.getByLabel('Personal key').blur()
  await page.getByRole('button', { name: '‹ Library' }).click()
  for (const host of Object.keys(PAGES)) {
    await page.getByLabel('Web address').fill(`https://${host}/`)
    await page.getByRole('button', { name: 'Import', exact: true }).click()
    await page.locator('.stage[data-ready]').waitFor()
    await page.getByRole('button', { name: 'Back to library' }).click()
    await page.getByLabel('Web address').waitFor()
  }
}

// locator, not a snapshot of text: assertions on it retry until the screen has updated (slow CI machines)
const cards = (page: Page) => page.locator('.pagecard .ptitle')
const options = (page: Page, name: string) => page.getByRole('button', { name: `Options for ${name}` })

async function newCollection(page: Page, name: string) {
  await page.getByRole('button', { name: 'New collection' }).first().click()
  await page.getByLabel('Name').fill(name)
  await page.getByRole('button', { name: 'Create' }).click()
}

test('collections: create, file a page, filter, then delete keeps the page', async ({ page }) => {
  await seed(page)
  await newCollection(page, 'Work')
  await options(page, 'Alpha Guide').click()
  await page.getByRole('group', { name: 'Collection' }).getByRole('button', { name: 'Work' }).click()
  await page.getByRole('button', { name: 'Done' }).click()

  await page.locator('.nav', { hasText: 'Work' }).click()
  await expect(cards(page)).toHaveText(['Alpha Guide'])
  await expect(page.locator('.nav', { hasText: 'Unsorted' }).locator('.count')).toHaveText('3') // beta, gamma, sample

  await page.getByRole('button', { name: 'Edit collection Work' }).click({ force: true })
  page.once('dialog', (d) => void d.accept())
  await page.getByRole('button', { name: 'Delete' }).click()
  await page.locator('.nav', { hasText: 'All pages' }).click()
  await expect(cards(page).filter({ hasText: 'Alpha Guide' })).toHaveCount(1)
  await expect(page.locator('.nav', { hasText: 'Work' })).toHaveCount(0)
})

test('tags and search narrow the library, and empty results say so', async ({ page }) => {
  await seed(page)
  await options(page, 'Beta Notes').click()
  await page.getByLabel('Tags').fill('Design, #UX')
  await page.getByLabel('Tags').blur()
  await page.getByRole('button', { name: 'Done' }).click()

  await page.locator('.tagcloud .chip', { hasText: '#design' }).click()
  await expect(cards(page)).toHaveText(['Beta Notes'])
  await page.getByRole('button', { name: 'Clear tag design' }).click()

  await page.getByLabel('Search').fill('gamma')
  await expect(cards(page)).toHaveText(['Gamma Docs'])
  await page.getByLabel('Search').fill('ux') // tag text is searchable
  await expect(cards(page)).toHaveText(['Beta Notes'])
  await page.getByLabel('Search').fill('no such thing')
  await expect(page.getByText('Nothing matches')).toBeVisible()
})

test('pinned pages come first and the sort order changes the list', async ({ page }) => {
  await seed(page)
  await page.getByRole('button', { name: 'Pin Gamma Docs' }).click()
  await expect(cards(page).first()).toHaveText('Gamma Docs')
  await page.getByLabel('Sort').selectOption('name')
  await expect(cards(page)).toHaveText(['Gamma Docs', 'Alpha Guide', 'Beta Notes', 'How a web page works (sample)']) // pinned first, then A to Z
  await page.locator('.nav', { hasText: 'Pinned' }).click()
  await expect(cards(page)).toHaveText(['Gamma Docs'])
})

test('layout, sort, theme and accent persist across a reload', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'List view' }).click()
  await page.getByLabel('Sort').selectOption('name')
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Light' }).click()
  await page.getByRole('button', { name: 'Accent #ff2d55' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  expect(await page.evaluate(() => document.documentElement.style.getPropertyValue('--accent'))).toBe('#ff2d55')

  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  expect(await page.evaluate(() => document.documentElement.style.getPropertyValue('--accent'))).toBe('#ff2d55')
  await page.getByRole('button', { name: '‹ Library' }).click()
  await expect(page.locator('.list')).toBeVisible()
  await expect(page.getByLabel('Sort')).toHaveValue('name')
})

test('dragging a card onto a collection files it', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'Playwright WebKit does not drive HTML5 drag and drop reliably')
  await seed(page)
  await newCollection(page, 'Inbox')
  await page.getByRole('button', { name: 'Open Gamma Docs' }).dragTo(page.locator('.nav', { hasText: 'Inbox' }))
  await expect(page.locator('.nav', { hasText: 'Inbox' }).locator('.count')).toHaveText('1')
})
