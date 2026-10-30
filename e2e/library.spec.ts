import { expect, test, type Page } from '@playwright/test'

const ARTICLE = `<!doctype html><html><head><title>Mock Article</title></head><body><h1>Mock Article</h1>${'<p>Real readable paragraph text for the snapshot. </p>'.repeat(20)}<a href="https://other.example/next">Next page</a></body></html>`
const SHELL = '<!doctype html><html><head><title>Shell App</title></head><body><div id="root"></div></body></html>'

async function setKey(page: Page, key = 'secret') {
  await page.goto('/#/settings')
  await page.getByLabel('Personal key').fill(key)
  await page.getByLabel('Personal key').blur()
  await page.getByRole('button', { name: '‹ Library' }).click()
}

async function mockApi(page: Page, handlers: { fetch?: string; render?: string; calls?: string[] }) {
  await page.route('**/api/fetch', (r) => {
    handlers.calls?.push('fetch')
    r.fulfill({ json: { html: handlers.fetch ?? ARTICLE, finalUrl: 'https://mock.example/article', status: 200 } })
  })
  await page.route('**/api/render', (r) => {
    handlers.calls?.push('render')
    r.fulfill({ json: { html: handlers.render ?? ARTICLE, finalUrl: 'https://mock.example/article', status: 200 } })
  })
}

const address = (page: Page) => page.getByLabel('Web address')
const importBtn = (page: Page) => page.getByRole('button', { name: 'Import', exact: true })

test('library shows the sample and opens it', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('How a web page works (sample)').first()).toBeVisible()
  await page.getByRole('button', { name: /^Open How a web page works/ }).click()
  await expect(page.locator('.stage[data-ready]')).toBeAttached()
  await page.getByRole('button', { name: 'Back to library' }).click()
  await expect(address(page)).toBeVisible()
})

test('import by URL uses fetch for a content page and shows it as a card', async ({ page }) => {
  const calls: string[] = []
  await mockApi(page, { calls })
  await setKey(page)
  await address(page).fill('mock.example/article')
  await importBtn(page).click()
  await expect(page.locator('.stage[data-ready]')).toBeAttached()
  expect(calls).toEqual(['fetch'])
  await page.getByRole('button', { name: 'Back to library' }).click()
  await expect(page.getByRole('button', { name: /^Open Mock Article/ })).toBeVisible()
  await expect(page.locator('.pagecard .host', { hasText: 'mock.example' })).toBeVisible()
})

test('an empty app shell automatically falls back to render', async ({ page }) => {
  const calls: string[] = []
  await mockApi(page, { fetch: SHELL, render: ARTICLE, calls })
  await setKey(page)
  await address(page).fill('https://mock.example/app')
  await importBtn(page).click()
  await expect(page.locator('.stage[data-ready]')).toBeAttached()
  expect(calls).toEqual(['fetch', 'render'])
})

test('a rejected key shows a friendly error', async ({ page }) => {
  await page.route('**/api/fetch', (r) => r.fulfill({ status: 401, json: { error: 'UNAUTHORIZED', message: 'Key rejected' } }))
  await setKey(page, 'wrong')
  await address(page).fill('https://mock.example/')
  await importBtn(page).click()
  await expect(page.getByRole('alert')).toContainText('Key rejected')
})

test('importing a saved .html file works and never executes its script', async ({ page }) => {
  await page.goto('/')
  const html = '<!doctype html><title>Saved</title><h1>Saved page</h1><script>window.__pwned = 1</script><img src=x onerror="window.__pwned = 2">'
  await page.locator('input[type=file]').setInputFiles({ name: 'saved.html', mimeType: 'text/html', buffer: Buffer.from(html) })
  await expect(page.locator('.stage[data-ready]')).toBeAttached()
  const frame = page.frameLocator('iframe.viewer-frame')
  await expect(frame.locator('h1')).toHaveText('Saved page')
  expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined()
  expect(await frame.locator('body').evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined()
})

async function importedHeight(page: Page, html: string) {
  await page.goto('/')
  await page.locator('input[type=file]').setInputFiles({ name: 'p.html', mimeType: 'text/html', buffer: Buffer.from(html) })
  await expect(page.locator('.stage[data-ready]')).toBeAttached()
  return Number(await page.locator('svg.viewer-ink').getAttribute('height'))
}

test('a page with html/body height 100% keeps its full height (Wikipedia-style)', async ({ page }) => {
  // html and body are one window tall and body clips its overflow, and the only child is a zero-height wrapper:
  // neither html.scrollHeight nor the child's position knows the real height; only body.scrollHeight does
  const rows = '<div style="height:60px;border-bottom:1px solid #ccc">A row of real content.</div>'.repeat(120)
  const h = await importedHeight(page, `<!doctype html><title>Tall</title><style>html,body{height:100%;margin:0}body{overflow:hidden}</style><body><div style="height:0">${rows}</div></body>`)
  expect(h).toBeGreaterThan(7000)
})

test('a short page is not stretched to the measuring window', async ({ page }) => {
  const h = await importedHeight(page, '<!doctype html><title>Short</title><body style="margin:0"><h1 style="margin:0;height:120px">Hi</h1></body>')
  expect(h).toBeLessThan(600)
  expect(h).toBeGreaterThanOrEqual(120)
})

test('rename and delete from the page options sheet', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /Options for How a web page works/ }).click()
  await page.getByLabel('Title').fill('Renamed sample')
  await page.getByLabel('Title').blur()
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByRole('button', { name: /^Open Renamed sample/ })).toBeVisible()
  await page.getByRole('button', { name: /Options for Renamed sample/ }).click()
  page.once('dialog', (d) => void d.accept())
  await page.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByRole('button', { name: /^Open Renamed sample/ })).toHaveCount(0)
})
