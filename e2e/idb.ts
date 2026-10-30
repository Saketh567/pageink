import type { Page } from '@playwright/test'

/**
 * The app saves in the background, so a test that reloads right after an action can beat the write on a slow
 * machine. These read the real database, to be used with expect.poll before reloading.
 */
export const savedSetting = (page: Page, key: string) =>
  page.evaluate(
    (k) =>
      new Promise((resolve) => {
        const open = indexedDB.open('pageink')
        open.onsuccess = () => {
          const q = open.result.transaction('settings').objectStore('settings').get(k)
          q.onsuccess = () => resolve(q.result?.value ?? null)
        }
      }),
    key,
  )

export const savedAnnotations = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const open = indexedDB.open('pageink')
        open.onsuccess = () => {
          const q = open.result.transaction('annotations').objectStore('annotations').getAll()
          q.onsuccess = () => resolve((q.result as Array<{ deleted?: boolean }>).filter((a) => !a.deleted).length)
        }
      }),
  )
