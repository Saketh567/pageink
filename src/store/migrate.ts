/**
 * Upgrades stored data one numbered step at a time. The library remembers its data version, so a step runs once, in order, and
 * every later feature can change what is stored without risk. A step must be safe to run twice and must never delete user data.
 * Quick steps run before the app is shown; slow ones (`background`) run afterwards in small batches so the screen stays alive.
 */
import { extractText, getSetting, migrateToAutoLayout, setSetting } from './repo.ts'
import { getDb } from './db.ts'

/** What version a library is assumed to be when it has never recorded one: the oldest, so every step is considered (each is safe to repeat). */
const ASSUMED = 1

interface Step { to: number; name: string; background?: boolean; run(): Promise<void> }

const BATCH = 25
const yieldToScreen = () => new Promise<void>((r) => setTimeout(r))

/** Keep the text of every page, so searching later never has to open page copies. */
async function fillPageText() {
  const db = await getDb()
  const have = new Set(await db.getAllKeys('texts'))
  const todo = (await db.getAllKeys('snapshots')).filter((k) => !have.has(k))
  for (let i = 0; i < todo.length; i += BATCH) {
    for (const id of todo.slice(i, i + BATCH)) {
      const [snap, page] = await Promise.all([db.get('snapshots', id), db.get('pages', id)])
      if (snap) await db.put('texts', { pageId: id, title: page?.title ?? '', text: extractText(snap.html) })
    }
    await yieldToScreen()
  }
}

const STEPS: Step[] = [
  { to: 2, name: 'pages follow the screen width (Auto layout)', run: migrateToAutoLayout },
  { to: 3, name: 'keep the text of every page for search', background: true, run: fillPageText },
]

async function runSteps(background: boolean) {
  let version = (await getSetting<number>('dataVersion')) ?? ASSUMED
  for (const s of STEPS) {
    if (s.to <= version || !!s.background !== background) continue
    await s.run()
    version = s.to
    await setSetting('dataVersion', version)
  }
}

/** Quick upgrades: run once at start-up, before the screen is shown. */
export const runMigrations = () => runSteps(false)

/** Slow upgrades: run after the app is ready. Safe to call more than once. */
export const runBackgroundMigrations = () => runSteps(true)

/** The data version this library has now. */
export async function dataVersion() {
  return (await getSetting<number>('dataVersion')) ?? ASSUMED
}
