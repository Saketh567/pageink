import { useEffect, useRef, useState } from 'preact/hooks'
import { createEditor } from '../ink/editor.ts'
import { importUrl } from '../import/import-url.ts'
import { getPage, getSnapshot, listAnnotations, savePage } from '../store/repo.ts'
import { attachLinkTaps, type LinkTap } from '../viewer/links.ts'
import { createViewer } from '../viewer/viewer.ts'
import { appKey, canRedo, canUndo, go, mode } from './state.ts'
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
      host.current.dataset.ready = '1'
      stop = () => { editor.destroy(); viewer.destroy() }
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
    <div class="app">
      <div ref={host} class="stage" />
      <ToolTray />
      {missing && <p class="toast">This page is no longer in your library.</p>}
      {busy && <p class="toast" role="status">{busy}</p>}
      {error && <p class="toast error" role="alert" onClick={() => setError('')}>{error}</p>}
      {link && (
        <div class="sheet-backdrop" onClick={() => setLink(null)}>
          <div class="sheet" role="dialog" aria-label="Link" onClick={(e) => e.stopPropagation()}>
            <p class="hint">{link.text || link.href}</p>
            <p class="url">{link.href}</p>
            <button class="primary" disabled={!appKey.value} onClick={() => void importLink(link)}>Import this page</button>
            <button onClick={() => { window.open(link.href, '_blank', 'noopener'); setLink(null) }}>Open original in Safari</button>
            <button class="ghost" onClick={() => setLink(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
