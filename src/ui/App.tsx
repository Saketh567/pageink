import { useEffect, useRef } from 'preact/hooks'
import { createEditor } from '../ink/editor.ts'
import { getPage, getSnapshot, listAnnotations, SAMPLE_ID, savePage, seedSample, setSetting } from '../store/repo.ts'
import { createViewer } from '../viewer/viewer.ts'
import { ToolTray } from './ToolTray.tsx'

async function requestPersistence() {
  const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone
  if (!standalone || !navigator.storage?.persist) return
  await setSetting('storagePersisted', await navigator.storage.persist())
}

export function App() {
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let stop = () => {}
    let cancelled = false
    void (async () => {
      await seedSample(() => fetch('/sample/sample-page.html').then((r) => r.text()))
      const [page, snap, annotations] = await Promise.all([getPage(SAMPLE_ID), getSnapshot(SAMPLE_ID), listAnnotations(SAMPLE_ID)])
      if (cancelled || !page || !snap || !host.current) return
      const viewer = await createViewer(host.current, snap.html, page.layoutWidth)
      if (cancelled) return viewer.destroy()
      if (viewer.docHeight !== page.docHeight) await savePage({ ...page, docHeight: viewer.docHeight, updatedAt: new Date().toISOString() })
      const editor = createEditor(viewer, page.id, annotations)
      stop = () => { editor.destroy(); viewer.destroy() }
      void requestPersistence()
    })()
    return () => { cancelled = true; stop() }
  }, [])

  return (
    <div class="app">
      <div ref={host} class="stage" />
      <ToolTray />
    </div>
  )
}
