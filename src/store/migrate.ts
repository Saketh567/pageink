/**
 * Upgrades stored data one numbered step at a time. The library remembers its data version, so a step runs once, in order, and
 * every later feature can change what is stored without risk. A step must be safe to run twice and must never delete user data.
 * Quick steps run before the app is shown; slow ones (`background`) run afterwards in small batches so the screen stays alive.
 */
import { HOME, seedLayout } from '../atlas/seed.ts'
import { listCards, putBoard, putCards } from './board-repo.ts'
import { getDb } from './db.ts'
import { extractText, getSetting, listCollections, listPages, migrateToAutoLayout, setSetting } from './repo.ts'

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

/** Every saved page gets a poster on a desk called Home, grouped in a frame per collection. Cards you already moved are never moved back. */
async function seedHomeBoard() {
  const db = await getDb()
  if (!(await db.get('boards', HOME))) {
    const now = new Date().toISOString()
    await putBoard({ id: HOME, name: 'Home', hue: 210, order: 0, createdAt: now, updatedAt: now })
  }
  const have = new Set((await listCards(HOME)).map((c) => c.id))
  await putCards(seedLayout(await listPages(), await listCollections()).filter((c) => !have.has(c.id)))
}

const STEPS: Step[] = [
  { to: 2, name: 'pages follow the screen width (Auto layout)', run: migrateToAutoLayout },
  { to: 3, name: 'keep the text of every page for search', background: true, run: fillPageText },
  { to: 4, name: 'your library becomes your first desk', run: seedHomeBoard },
]

/** The steps already done: those recorded one by one, and all up to the old single version number (libraries upgraded before steps were recorded). */
async function doneSteps() {
  const legacy = (await getSetting<number>('dataVersion')) ?? ASSUMED
  const done = new Set<number>()
  for (const s of STEPS) if (s.to <= legacy || (await getSetting<boolean>(`migrated:${s.to}`))) done.add(s.to)
  return done
}

async function runSteps(background: boolean) {
  const done = await doneSteps()
  for (const s of STEPS) {
    if (done.has(s.to) || !!s.background !== background) continue
    await s.run()
    await setSetting(`migrated:${s.to}`, true)
    done.add(s.to)
    // the version shown is how far the unbroken run of finished steps goes
    let version = ASSUMED
    for (const t of STEPS) { if (done.has(t.to)) version = t.to; else break }
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
