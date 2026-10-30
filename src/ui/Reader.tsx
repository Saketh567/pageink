import { effect } from '@preact/signals'
import { useEffect, useRef, useState } from 'preact/hooks'
import { createEditor } from '../ink/editor.ts'
import { importUrl } from '../import/import-url.ts'
import { getPage, getSnapshot, listAnnotations, patchPage, savePage } from '../store/repo.ts'
import { attachLinkTaps, type LinkTap } from '../viewer/links.ts'
import { createViewer } from '../viewer/viewer.ts'
import { HeatStrip } from './HeatStrip.tsx'
import { MarksPanel } from './MarksPanel.tsx'
import { NoteCard } from './NoteCard.tsx'
import { activeViewer, appKey, canRedo, canUndo, currentPage, go, margin, mode, panelOpen } from './state.ts'
import { ToolTray } from './ToolTray.tsx'

export function Reader({ pageId }: { pageId: string }) {
  const host = useRef<HTMLDivElement>(null)
  const [link, setLink] = useState<LinkTap | null>(null)
  const [width, setWidth] = useState(1280)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    let stop = () => {}
    let cancelled = false
    canUndo.value = canRedo.value = false
    void (async () => {
      const [page, snap, annotations] = await Promise.all([getPage(pageId), getSnapshot(pageId), listAnnotations(pageId)])
      if (cancelled) return
      if (!page || !snap || !host.current) return setMissing(true)
      setWidth(page.layoutWidth)
      const viewer = await createViewer(host.current, snap.html, page.layoutWidth)
      if (cancelled) return viewer.destroy()
      if (viewer.docHeight !== page.docHeight) await savePage({ ...page, docHeight: viewer.docHeight })
      const editor = createEditor(viewer, page.id, annotations)
      attachLinkTaps(viewer, () => mode.value === 'read', setLink)
      void patchPage(page.id, { openedAt: new Date().toISOString() })
      activeViewer.value = viewer
      currentPage.value = page

      // pick up where you left off: the margin lane and the scroll position
      margin.value = page.view?.margin ?? false
      const stopLane = effect(() => editor.setLane(margin.value))
      if (page.view?.scrollTop) viewer.container.scrollTop = page.view.scrollTop * viewer.scale
      let saveTimer: ReturnType<typeof setTimeout> | undefined
      const saveView = () => {
        clearTimeout(saveTimer)
        void patchPage(page.id, { view: { scrollTop: Math.round(viewer.container.scrollTop / viewer.scale), margin: margin.value } })
      }
      const onScroll = () => { clearTimeout(saveTimer); saveTimer = setTimeout(saveView, 600) }
      viewer.container.addEventListener('scroll', onScroll, { passive: true })
      const stopSave = effect(() => { void margin.value; if (host.current?.dataset.ready) saveView() })
      addEventListener('pagehide', saveView)

      host.current.dataset.ready = '1'
      stop = () => {
        saveView()
        removeEventListener('pagehide', saveView)
        viewer.container.removeEventListener('scroll', onScroll)
        stopSave()
        stopLane()
        editor.destroy()
        viewer.destroy()
        activeViewer.value = null
        currentPage.value = null
        panelOpen.value = false
      }
    })()
    return () => { cancelled = true; stop() }
  }, [pageId])

  async function importLink(l: LinkTap) {
    setLink(null)
    setError('')
    try {
      const page = await importUrl(l.href, width, appKey.value, setBusy)
      go(`/p/${page.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed.')
    } finally {
      setBusy('')
    }
  }

  return (
    <div class={`app ${panelOpen.value ? 'has-panel' : ''}`}>
      <div ref={host} class="stage" />
      <HeatStrip />
      <ToolTray />
      <MarksPanel />
      <NoteCard />
      {missing && <p class="toast">This page is no longer in your library.</p>}
      {busy && <p class="toast" role="status">{busy}</p>}
      {error && <p class="toast error" role="alert" onClick={() => setError('')}>{error}</p>}
      {link && (
        <div class="sheet-backdrop" onClick={() => setLink(null)}>
          <div class="sheet" role="dialog" aria-label="Link" onClick={(e) => e.stopPropagation()}>
            <h2>Open link</h2>
            <p class="hint">{link.text || link.href}</p>
            <p class="url">{link.href}</p>
            <button class="btn primary" onClick={() => void importLink(link)}>Import this page</button>
            <button class="btn" onClick={() => { window.open(link.href, '_blank', 'noopener'); setLink(null) }}>Open original in Safari</button>
            <button class="btn ghost" onClick={() => setLink(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
