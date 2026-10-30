import { expect, test } from '@playwright/test'

// Behaviour: the library records its data format, and the slow upgrade (page text for search) finishes after start-up.
// Related: e2e/backup.spec.ts covers backup and restore; the upgrade itself is covered by test/migrate.test.ts.
test('Settings shows the library format once upgrades have finished, and pages are still there', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 })
  await page.goto('/#/settings')
  await expect(page.getByText('Library format')).toBeVisible()
  await expect(page.locator('.line', { hasText: 'Library format' }).locator('span').last()).toHaveText('3')

  const state = await page.evaluate(async () => {
    const db: IDBDatabase = await new Promise((ok, no) => { const q = indexedDB.open('pageink'); q.onsuccess = () => ok(q.result); q.onerror = () => no(q.error) })
    const count = (store: string): Promise<number> => new Promise((ok) => { const q = db.transaction(store).objectStore(store).count(); q.onsuccess = () => ok(q.result) })
    return { version: db.version, pages: await count('pages'), texts: await count('texts') }
  })
  expect(state.version).toBe(3)
  expect(state.pages).toBeGreaterThan(0) // the bundled sample page
  expect(state.texts).toBe(state.pages) // every page has its text kept
})
