/**
 * The app shell: starts the database and settings, picks the screen from the address (library, reader, settings),
 * and offers a reload when a new version is ready.
 */
import { useEffect, useState } from 'preact/hooks'
import { migrateToAutoLayout, seedSample, setSetting } from '../store/repo.ts'
import { loadAppearance, startAppearance } from './appearance.ts'
import { Library } from './Library.tsx'
import { Reader } from './Reader.tsx'
import { loadSettings, Settings } from './Settings.tsx'
import { route, updateReady } from './state.ts'

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
      await migrateToAutoLayout()
      await Promise.all([loadSettings(), loadAppearance()])
      startAppearance()
      setReady(true)
      void requestPersistence()
    })()
  }, [])
  if (!ready) return null

  const r = route.value
  const screen = r.startsWith('/p/') ? <Reader key={r} pageId={r.slice(3)} /> : r === '/settings' ? <Settings /> : <Library />
  return (
    <>
      {screen}
      {updateReady.value && (
        <button class="updatechip" onClick={() => location.reload()}>New version ready. Tap to update</button>
      )}
    </>
  )
}
