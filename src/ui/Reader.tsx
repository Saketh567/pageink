/**
 * The reading screen: opens a saved page, wires up marking, link following, carousels and the toolbar, and
 * remembers where you were. Same-site links import and open the next page.
 */
import { effect } from '@preact/signals'
import { useEffect, useRef, useState } from 'preact/hooks'
import { createEditor } from '../ink/editor.ts'
import { sanitize, SANITIZER_VERSION } from '../import/sanitize.ts'
import { importUrl, recapturePage } from '../import/import-url.ts'
import { findPageByUrl, getPage, getSnapshot, getSetting, listAnnotations, patchPage, putSnapshot, savePage, setSetting } from '../store/repo.ts'
import { attachLinkTaps, type LinkTap } from '../viewer/links.ts'
import { attachSideScroll } from '../viewer/scrollers.ts'
import { revealHidden } from '../viewer/widgets.ts'
import { createViewer } from '../viewer/viewer.ts'
import { HeatStrip } from './HeatStrip.tsx'
import { MarksPanel } from './MarksPanel.tsx'
import { NoteCard } from './NoteCard.tsx'
import { activeViewer, appKey, canRedo, canUndo, actions, currentPage, drawWithFinger, go, margin, mode, notice, panelOpen, trail } from './state.ts'
import { ToolTray } from './ToolTray.tsx'

export function Reader({ pageId }: { pageId: string }) {
  const host = useRef<HTMLDivElement>(null)
  const [link, setLinkRaw] = useState<LinkTap | null>(null)
  const linkAt = useRef(0)
  const following = useRef(false)
  const live = useRef(pageId) // the page on screen now, for work that finishes later
  live.current = pageId
  const setLink = (l: LinkTap | null) => { linkAt.current = performance.now(); setLinkRaw(l) }
  const [width, setWidth] = useState(1280)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [missing, setMissing] = useState(false)
  const [reload, setReload] = useState(0)
  const [prev, setPrev] = useState<{ id: string; title: string } | null>(null)
  const trailTop = trail.value[trail.value.length - 1]

  useEffect(() => {
    let stop = () => {}
    let cancelled = false
    canUndo.value = canRedo.value = false
    void (async () => {
      const [page, snap, annotations] = await Promise.all([getPage(pageId), getSnapshot(pageId), listAnnotations(pageId)])
      if (cancelled) return
      if (!page || !snap || !host.current) return setMissing(true)
      setWidth(page.layoutWidth)
      // pages saved by an older version are cleaned again once, so they get the newer image handling too
      let html = snap.html
      if (snap.sanitizerVersion < SANITIZER_VERSION) {
        html = sanitize(snap.html, page.url || undefined)
        void putSnapshot({ pageId: page.id, html, sanitizerVersion: SANITIZER_VERSION })
      }
      const viewer = await createViewer(host.current, html, page.layoutWidth)
      if (cancelled) return viewer.destroy()
      if (viewer.docHeight !== page.docHeight) await savePage({ ...page, docHeight: viewer.docHeight })
      // text that a site fades in with its own scripts would otherwise stay invisible in a saved copy
      const idoc = viewer.iframe.contentDocument
      if (idoc && revealHidden(idoc)) viewer.remeasure()
      const editor = createEditor(viewer, page.id, annotations)
      // a link to another page of the same site opens that page right away; other sites ask first
      const sameSite = (href: string) => {
        try { return !!page.url && new URL(href).origin === new URL(page.url).origin } catch { return false }
      }
      // a finger always browses; the Pencil (or a mouse) marks unless Read mode is on
      attachLinkTaps(viewer, (e) => mode.value === 'read' || (e.pointerType === 'touch' && !drawWithFinger.value), (l) => (sameSite(l.href) ? void followLink(l.href, page.id, page.layoutWidth) : setLink(l)))
      const stopSide = attachSideScroll(viewer, () => !(mode.value === 'markup' && drawWithFinger.value))
      void patchPage(page.id, { openedAt: new Date().toISOString() })
      void setSetting('lastPage', page.id) // the library offers to continue here
      void getSetting('hintSeen').then((seen) => {
        if (seen || cancelled) return
        notice.value = 'Finger: scroll and tap links  ·  Pencil: mark'
        void setSetting('hintSeen', true)
      })
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
        stopSide()
        editor.destroy()
        viewer.destroy()
        activeViewer.value = null
        currentPage.value = null
        panelOpen.value = false
      }
    })()
    return () => { cancelled = true; stop() }
  }, [pageId, reload])

  actions.recapture = () => {
    if (following.current) return
    following.current = true
    setError('')
    void recapturePage(pageId, 'render', appKey.value, setBusy)
      .then(() => { notice.value = 'Loaded the full page. Your marks are kept.'; setReload((n) => n + 1) })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the full page.'))
      .finally(() => { following.current = false; setBusy('') })
  }

  /** Opens another page: the copy you already have, or a fresh import. A Back chip then leads back to where you came from. */
  async function followLink(href: string, fromId: string, layout: number) {
    if (following.current) return // a second tap while the first page is still coming in
    following.current = true
    setError('')
    try {
      if (await findPageByUrl(href)) notice.value = 'Opened your saved copy'
      const next = await importUrl(href, layout, appKey.value, setBusy)
      if (live.current !== fromId) return // you went somewhere else meanwhile: the page is saved, but do not pull you away
      if (next.id !== fromId) trail.value = [...trail.value.filter((id) => id !== next.id), fromId]
      go(`/p/${next.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed.')
    } finally {
      following.current = false
      setBusy('')
    }
  }
  const importLink = (l: LinkTap) => { setLink(null); void followLink(l.href, pageId, width) }

  useEffect(() => {
    if (!trailTop || trailTop === pageId) { setPrev(null); return }
    let stale = false
    void getPage(trailTop).then((p) => { if (!stale) setPrev(p ? { id: trailTop, title: p.title } : null) })
    return () => { stale = true }
  }, [pageId, trailTop])

  useEffect(() => {
    if (!notice.value) return
    const t = setTimeout(() => { notice.value = '' }, 2600)
    return () => clearTimeout(t)
  }, [notice.value])

  return (
    <div class={`app ${panelOpen.value ? 'has-panel' : ''}`}>
      <div ref={host} class="stage" />
      <HeatStrip />
      <ToolTray />
      <MarksPanel />
      <NoteCard />
      {prev && (
        <button class="trailchip" aria-label={`Back to ${prev.title}`} onClick={() => { trail.value = trail.value.slice(0, -1); go(`/p/${prev.id}`) }}>
          <span aria-hidden="true">‹</span><span class="t">{prev.title}</span>
        </button>
      )}
      {notice.value && <p class="toast" role="status">{notice.value}</p>}
      {missing && <p class="toast">This page is no longer in your library.</p>}
      {busy && <p class="toast" role="status">{busy}</p>}
      {error && <p class="toast error" role="alert" onClick={() => setError('')}>{error}</p>}
      {link && (
        <div class="sheet-backdrop" onClick={() => performance.now() - linkAt.current > 400 && setLink(null)}>
          <div class="sheet" role="dialog" aria-label="Link" onClick={(e) => e.stopPropagation()}>
            <h2>Open link</h2>
            <p class="hint">{link.text || link.href}</p>
            <p class="url">{link.href}</p>
            <button class="btn primary" onClick={() => importLink(link)}>Import this page</button>
            <button class="btn" onClick={() => { window.open(link.href, '_blank', 'noopener'); setLink(null) }}>Open original in Safari</button>
            <button class="btn ghost" onClick={() => setLink(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
