/**
 * The app shell: starts the database and settings, picks the screen from the address (library, reader, settings),
 * and offers a reload when a new version is ready.
 */
import { useEffect, useState } from 'preact/hooks'
import { dataVersion, runBackgroundMigrations, runMigrations } from '../store/migrate.ts'
import { seedSample, setSetting } from '../store/repo.ts'
import { loadAppearance, startAppearance } from './appearance.ts'
import { Atlas } from '../atlas/Atlas.tsx'
import { Library } from './Library.tsx'
import { Reader } from './Reader.tsx'
import { loadSettings, Settings } from './Settings.tsx'
import { libraryFormat, route, updateReady } from './state.ts'

async function requestPersistence() {
  const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone
  if (!standalone || !navigator.storage?.persist) return
  await setSetting('storagePersisted', await navigator.storage.persist())
}

export function App() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    // a new service worker taking over means newer code is ready: offer a reload instead of interrupting what you are doing
    const sw = navigator.serviceWorker
    if (sw?.controller) sw.addEventListener('controllerchange', () => (updateReady.value = true), { once: true })
    void (async () => {
      await seedSample(() => fetch('/sample/sample-page.html').then((r) => r.text()))
      await runMigrations()
      libraryFormat.value = await dataVersion()
      await Promise.all([loadSettings(), loadAppearance()])
      startAppearance()
      setReady(true)
      void runBackgroundMigrations().then(async () => { libraryFormat.value = await dataVersion() }) // slow upgrades (like indexing page text) run after the screen is up
      void requestPersistence()
    })()
  }, [])
  if (!ready) return null

  const r = route.value
  // the desk is home; a page link opens the plain reader; the old grid of cards lives on at #/shelf
  const screen = r.startsWith('/p/') ? <Reader key={r} pageId={r.slice(3)} /> : r === '/settings' ? <Settings /> : r === '/shelf' ? <Library /> : <Atlas />
  return (
    <>
      {screen}
      {updateReady.value && (
        <button class="updatechip" onClick={() => location.reload()}>New version ready. Tap to update</button>
      )}
    </>
  )
}
