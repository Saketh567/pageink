import { useEffect, useState } from 'preact/hooks'
import { seedSample, setSetting } from '../store/repo.ts'
import { loadAppearance, startAppearance } from './appearance.ts'
import { Library } from './Library.tsx'
import { Reader } from './Reader.tsx'
import { loadSettings, Settings } from './Settings.tsx'
import { route } from './state.ts'

async function requestPersistence() {
  const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone
  if (!standalone || !navigator.storage?.persist) return
  await setSetting('storagePersisted', await navigator.storage.persist())
}

export function App() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    void (async () => {
      await seedSample(() => fetch('/sample/sample-page.html').then((r) => r.text()))
      await Promise.all([loadSettings(), loadAppearance()])
      startAppearance()
      setReady(true)
      void requestPersistence()
    })()
  }, [])
  if (!ready) return null

  const r = route.value
  if (r.startsWith('/p/')) return <Reader key={r} pageId={r.slice(3)} />
  if (r === '/settings') return <Settings />
  return <Library />
}
