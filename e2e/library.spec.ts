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

test('library shows the sample and opens it', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('How a web page works (sample)')).toBeVisible()
  await page.getByRole('button', { name: /How a web page works/ }).first().click()
  await expect(page.locator('iframe.viewer-frame')).toBeVisible()
  await page.getByRole('button', { name: 'Back to library' }).click()
  await expect(page.getByPlaceholder('Paste a web address')).toBeVisible()
})

test('import by URL uses fetch for a content page and groups by site', async ({ page }) => {
  const calls: string[] = []
  await mockApi(page, { calls })
  await setKey(page)
  await page.getByPlaceholder('Paste a web address').fill('mock.example/article')
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await expect(page.locator('iframe.viewer-frame')).toBeVisible()
  expect(calls).toEqual(['fetch'])
  await page.getByRole('button', { name: 'Back to library' }).click()
  await expect(page.getByRole('heading', { name: 'mock.example' })).toBeVisible()
  await expect(page.getByText('Mock Article').first()).toBeVisible()
})

test('an empty app shell automatically falls back to render', async ({ page }) => {
  const calls: string[] = []
  await mockApi(page, { fetch: SHELL, render: ARTICLE, calls })
  await setKey(page)
  await page.getByPlaceholder('Paste a web address').fill('https://mock.example/app')
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await expect(page.locator('iframe.viewer-frame')).toBeVisible()
  expect(calls).toEqual(['fetch', 'render'])
})

test('a rejected key shows a friendly error', async ({ page }) => {
  await page.route('**/api/fetch', (r) => r.fulfill({ status: 401, json: { error: 'UNAUTHORIZED', message: 'Key rejected' } }))
  await setKey(page, 'wrong')
  await page.getByPlaceholder('Paste a web address').fill('https://mock.example/')
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Key rejected')
})

test('importing a saved .html file works and never executes its script', async ({ page }) => {
  await page.goto('/')
  const html = '<!doctype html><title>Saved</title><h1>Saved page</h1><script>window.__pwned = 1</script><img src=x onerror="window.__pwned = 2">'
  await page.locator('input[type=file]').setInputFiles({ name: 'saved.html', mimeType: 'text/html', buffer: Buffer.from(html) })
  await expect(page.locator('iframe.viewer-frame')).toBeVisible()
  const frame = page.frameLocator('iframe.viewer-frame')
  await expect(frame.locator('h1')).toHaveText('Saved page')
  expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined()
  expect(await frame.locator('body').evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined()
})

test('rename and delete from the library menu', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /Options for How a web page works/ }).click()
  page.once('dialog', (d) => void d.accept('Renamed sample'))
  await page.getByRole('button', { name: 'Rename' }).click()
  await expect(page.getByText('Renamed sample')).toBeVisible()
  await page.getByRole('button', { name: /Options for Renamed sample/ }).click()
  page.once('dialog', (d) => void d.accept())
  await page.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText('Renamed sample')).toHaveCount(0)
})
