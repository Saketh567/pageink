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
  await page.goto('/#/shelf')
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

  await page.goto('/#/shelf')
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

test('pictures that a site loads with its own script still appear', async ({ page }) => {
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC', 'base64')
  await page.route('https://img.example/**', (route) => route.fulfill({ body: PNG, contentType: 'image/png' }))
  const html = `<!doctype html><title>Lazy</title><style>.lazyload{opacity:0}.lazyloaded{opacity:1}.bg{width:200px;height:80px}</style><body style="margin:0">
    <h1>Lazy</h1><img id="a" class="lazyload" data-original="https://img.example/a.png" width="100" height="100">
    <img id="b" src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" data-lazy="https://img.example/b.png" width="100" height="100">
    <div id="c" class="bg" data-bg="https://img.example/c.png"></div>
    <div style="opacity:0"><img id="d" src="https://img.example/d.png" width="100" height="100"></div></body>`
  await page.setViewportSize({ width: 820, height: 1180 })
  await page.goto('/#/shelf')
  await page.locator('input[type=file]').setInputFiles({ name: 'lazy.html', mimeType: 'text/html', buffer: Buffer.from(html) })
  await expect(page.locator('.stage[data-ready]')).toBeAttached()
  const f = frame(page)
  for (const id of ['a', 'b', 'd']) {
    await expect.poll(() => f.locator('#' + id).evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 1)).toBe(true)
    await expect.poll(() => f.locator('#' + id).evaluate((i) => { let o = 1; for (let e: Element | null = i; e; e = e.parentElement) o = Math.min(o, Number(getComputedStyle(e).opacity)); return o })).toBe(1)
  }
  expect(await f.locator('#c').evaluate((e) => getComputedStyle(e).backgroundImage)).toContain('c.png')
})

test('marks on a carousel slide go with it when the carousel scrolls sideways', async ({ page }) => {
  const slide = (id: string, text: string) => `<div style="flex:0 0 400px;padding:20px;box-sizing:border-box"><p id="${id}" style="margin:0;font:22px Georgia">${text}</p></div>`
  const html = `<!doctype html><title>Carousel</title><body style="margin:0"><h1>Shoes</h1>
    <div id="rail" style="display:flex;width:400px;overflow-x:auto;scrollbar-width:none">${slide('one', 'First shoe: the classic leather runner in white.')}${slide('two', 'Second shoe: the lightweight trail model in green.')}</div>
    ${'<p style="margin:0 0 12px">Filler paragraph so the page is long enough to scroll properly.</p>'.repeat(20)}</body>`
  await page.setViewportSize({ width: 820, height: 1180 })
  await page.goto('/#/shelf')
  await page.locator('input[type=file]').setInputFiles({ name: 'rail.html', mimeType: 'text/html', buffer: Buffer.from(html) })
  await expect(page.locator('.stage[data-ready]')).toBeAttached()
  await page.getByRole('button', { name: 'Mark text' }).click()
  const box = (await frame(page).locator('#one').boundingBox())!
  await page.mouse.move(box.x + 20, box.y + 12)
  await page.mouse.down()
  await page.mouse.move(box.x + 120, box.y + 12, { steps: 8 })
  await page.mouse.up()
  const marks = page.locator('svg.viewer-ink g[data-layer=highlights] > g')
  await expect(marks).toHaveCount(1)

  await page.mouse.move(box.x + 100, box.y + 10)
  await page.mouse.wheel(400, 0) // sideways over the carousel
  await expect.poll(() => frame(page).locator('#rail').evaluate((e) => e.scrollLeft)).toBeGreaterThan(300)
  await expect(marks).toHaveCount(0) // slide one is out of sight, so is its highlight

  await page.mouse.wheel(-400, 0)
  await expect.poll(() => frame(page).locator('#rail').evaluate((e) => e.scrollLeft)).toBe(0)
  await expect(marks).toHaveCount(1)
})

test('"Reload with full rendering" fills in the page and keeps the marks', async ({ page }) => {
  const thin = '<!doctype html><title>Shop</title><body style="margin:0;font:20px Georgia"><h1>Shoes</h1><p id="para" style="margin:24px 0">The warranty covers manufacturing defects for two full years from purchase.</p><p>' + 'Shipping, returns and care information for every pair we sell is listed below the fold. '.repeat(5) + '</p></body>'
  const full = thin.replace('</body>', '<ul id="grid"><li>Air Runner, $120</li><li>Trail Pro, $140</li></ul></body>')
  const calls: string[] = []
  await page.route('**/api/fetch', (route) => { calls.push('fetch'); void route.fulfill({ json: { html: thin, finalUrl: 'https://shop.example/list', status: 200 } }) })
  await page.route('**/api/render', (route) => { calls.push('render'); void route.fulfill({ json: { html: full, finalUrl: 'https://shop.example/list', status: 200 } }) })
  await page.setViewportSize({ width: 820, height: 1180 })
  await page.goto('/#/shelf')
  await page.getByRole('textbox', { name: 'Web address' }).fill('https://shop.example/list')
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await expect(page.locator('.stage[data-ready]')).toBeAttached()
  await expect(frame(page).getByText('Air Runner')).toHaveCount(0)

  await page.getByRole('button', { name: 'Mark text' }).click()
  const box = (await frame(page).locator('#para').boundingBox())!
  await page.mouse.move(box.x + 30, box.y + 12)
  await page.mouse.down()
  await page.mouse.move(box.x + 120, box.y + 12, { steps: 8 })
  await page.mouse.up()
  const marks = page.locator('svg.viewer-ink g[data-layer=highlights] > g')
  await expect(marks).toHaveCount(1)

  await page.getByRole('button', { name: 'Reload with full rendering' }).click()
  await expect(frame(page).getByText('Air Runner')).toBeVisible()
  await expect(marks).toHaveCount(1) // the highlight found its words again
  expect(calls).toEqual(['fetch', 'render'])
})
