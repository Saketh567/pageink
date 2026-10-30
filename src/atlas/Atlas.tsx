/**
 * The Atlas: the home of PageInk 2. An endless dark desk where every saved page lies as a paper poster, grouped in labelled frames.
 * Drag to pan, pinch or scroll to zoom from tiny dots up to a full poster, drag a poster to move it, double-tap one to dive into the
 * real page (with all its marks) without leaving the desk, and rise back out. Importing drops the new poster in the middle of the view.
 */
import { useEffect, useRef, useState } from 'preact/hooks'
import { importFile } from '../import/file-import.ts'
import { importUrl } from '../import/import-url.ts'
import { archiveProgress } from '../archive/progress.ts'
import { getBoard, listCards, putCards, saveCamera } from '../store/board-repo.ts'
import { countAnnotations, getSetting, listPages, setSetting } from '../store/repo.ts'
import type { Board, Camera, Card, Page } from '../store/schema.ts'
import { appKey, backTo, defaultWidth, go, route } from '../ui/state.ts'
import { Reader } from '../ui/Reader.tsx'
import { fitRect, levelFor, lerpCam, union, viewRect, visible, type Level } from './camera.ts'
import { attachGestures } from './gestures.ts'
import { PAGE_H, PAGE_W, HOME, pageCardId, placeLoose } from './seed.ts'

type Row = Page & { notes: number }

const host = (p: Page) => { try { return p.url ? new URL(p.url).hostname.replace(/^www\./, '') : 'Saved file' } catch { return 'Saved page' } }
const hueOf = (key: string) => { let h = 0; for (const c of key) h = (h * 31 + c.charCodeAt(0)) % 360; return h }

/** Small line icons, same drawing style as the rest of the app. */
const Ico = ({ d }: { d: string[] }) => <svg viewBox="0 0 24 24" aria-hidden="true">{d.map((p) => <path key={p} d={p} />)}</svg>
const ICONS = {
  file: ['M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z', 'M14 3v5h5'],
  fit: ['M4 9V5h4', 'M20 9V5h-4', 'M4 15v4h4', 'M20 15v4h-4'],
  shelf: ['M4 5h16', 'M4 12h16', 'M4 19h16'],
  gear: ['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z'],
  moon: ['M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z'],
  sun: ['M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M12 2v2', 'M12 20v2', 'M4.9 4.9l1.4 1.4', 'M17.7 17.7l1.4 1.4', 'M2 12h2', 'M20 12h2', 'M4.9 19.1l1.4-1.4', 'M17.7 6.3l1.4-1.4'],
  rise: ['M6 15l6-6 6 6'],
  go: ['M5 12h14', 'M13 6l6 6-6 6'],
}

/** One page lying on the desk. How much it shows (data-lod) is decided by how big it is on screen. */
function PosterCard({ card, row, lod, lifted, fresh }: { card: Card; row: Row; lod: Level; lifted: boolean; fresh: boolean }) {
  const saved = row.offline === 'complete'
  const progress = archiveProgress.value[row.id]
  return (
    <article
      class={`card page${lifted ? ' lifted' : ''}${fresh ? ' settle' : ''}`} data-card={card.id} data-lod={lod}
      style={{ left: `${card.x}px`, top: `${card.y}px`, width: `${card.w}px`, height: `${card.h}px`, zIndex: String(card.z), '--h': String(hueOf(row.siteOrigin)) }}
    >
      <div class="band" />
      <div class="cover">
        <span class="initial">{(row.title.trim()[0] ?? '?').toUpperCase()}</span>
        {lod === 'poster' && row.cover && <img src={row.cover} alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')} />}
      </div>
      <h3 class="title">{row.title}</h3>
      <p class="meta">
        <span>{host(row)}</span>
        <span>{new Date(row.openedAt ?? row.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
        <span>{row.notes} mark{row.notes === 1 ? '' : 's'}</span>
        {progress ? <span class="saved">saving {progress.saved}/{progress.total}</span> : saved && <span class="saved">saved offline</span>}
      </p>
    </article>
  )
}

export function Atlas() {
  const match = /^\/b\/([^/]+)(?:\/p\/(.+))?$/.exec(route.value)
  const boardId = match?.[1] ?? HOME
  const diveId = match?.[2]

  const root = useRef<HTMLDivElement>(null)
  const worldEl = useRef<HTMLDivElement>(null)
  const cam = useRef<Camera>({ x: 0, y: 0, z: 1 })
  const cardsRef = useRef<Card[]>([])
  const pagesRef = useRef<Map<string, Row>>(new Map())
  const levels = useRef(new Map<string, Level>())
  const flight = useRef(0)
  const returnCam = useRef<Camera | null>(null)
  const moving = useRef<{ id: string; ids: string[] } | null>(null)

  const [board, setBoard] = useState<Board | null>(null)
  const [, setCards] = useState<Card[]>([])
  const [, tick] = useState(0)
  const [lifted, setLifted] = useState('')
  const [fresh, setFresh] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [url, setUrl] = useState('')
  const [world, setWorld] = useState<'night' | 'day'>('night')
  const [ready, setReady] = useState(false)

  useEffect(() => { backTo.value = '' }, [])

  const size = () => ({ w: root.current?.clientWidth ?? innerWidth, h: root.current?.clientHeight ?? innerHeight })

  // ---- the camera: written straight to the page every frame, and to state only a few times a second (that decides what is drawn)
  let raf = 0
  let stateTimer = 0
  const apply = () => {
    raf = 0
    const c = cam.current
    const w = worldEl.current
    const r = root.current
    if (!w || !r) return
    w.style.transform = `translate3d(${-c.x * c.z}px, ${-c.y * c.z}px, 0) scale(${c.z})`
    w.style.setProperty('--z', String(c.z))
    const g = 24 * c.z
    r.style.backgroundSize = `${g * 8}px ${g * 8}px, ${g}px ${g}px`
    r.style.backgroundPosition = `${-c.x * c.z}px ${-c.y * c.z}px`
    r.style.setProperty('--grid', c.z < 0.35 ? 'transparent' : '')
  }
  const setCam = (c: Camera) => {
    cam.current = c
    if (!raf) raf = requestAnimationFrame(apply)
    if (!stateTimer) {
      stateTimer = window.setTimeout(() => {
        stateTimer = 0
        tick((n) => n + 1)
        void saveCamera(boardId, cam.current)
      }, 90)
    }
  }
  const stopFlight = () => { cancelAnimationFrame(flight.current); flight.current = 0 }
  /** Fly the camera to `to` along an easing curve (instantly when motion is reduced). */
  const fly = (to: Camera, ms = 420, done?: () => void) => {
    stopFlight()
    const from = cam.current
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce || ms <= 0) { setCam(to); done?.(); return }
    const t0 = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / ms)
      setCam(lerpCam(from, to, 1 - (1 - t) ** 4, size()))
      if (t < 1) flight.current = requestAnimationFrame(step)
      else { flight.current = 0; done?.() }
    }
    flight.current = requestAnimationFrame(step)
  }
  const fitAll = (animate = true) => {
    const all = union(cardsRef.current)
    const to = all ? fitRect(all, size(), 64) : { x: -size().w / 2, y: -size().h / 2, z: 1 }
    if (animate) fly(to); else setCam(to)
  }

  // ---- load the board, its cards and the pages they show
  useEffect(() => {
    let dead = false
    void (async () => {
      const [b, cs, pages, w] = await Promise.all([getBoard(boardId), listCards(boardId), listPages(), getSetting<'night' | 'day'>('world')])
      const rows = await Promise.all(pages.map(async (p) => ({ ...p, notes: await countAnnotations(p.id) })))
      if (dead) return
      pagesRef.current = new Map(rows.map((r) => [r.id, r]))
      // a page that arrived some other way (the classic shelf, a followed link) has no poster yet: give it one beside the rest
      const have = new Set(cs.map((c) => c.pageId))
      const added = placeLoose(rows.filter((r) => !have.has(r.id)), cs, boardId)
      if (added.length) await putCards(added)
      const all = [...cs, ...added]
      cardsRef.current = all
      setCards(all)
      setBoard(b ?? null)
      if (w) setWorld(w)
      const saved = b?.camera
      const first = saved ?? (union(all) ? fitRect(union(all)!, size(), 64) : { x: -size().w / 2, y: -size().h / 2, z: 1 })
      cam.current = first
      apply()
      if (!saved && b) void saveCamera(boardId, first) // the first view is remembered too, so a reload comes back to exactly this
      setReady(true)
    })()
    return () => { dead = true }
  }, [boardId])

  // ---- gestures
  useEffect(() => {
    const el = root.current
    if (!el || !ready) return
    return attachGestures(el, {
      cam: () => cam.current,
      setCam,
      locked: () => !!diveIdRef.current,
      stopFlight,
      fit: () => fitAll(),
      cardAt: (target) => {
        const c = target.closest<HTMLElement>('[data-card]')
        if (!c) return null
        if (c.classList.contains('frame') && !target.closest('[data-handle]')) return null // empty frame interior pans the desk
        return { id: c.dataset.card! }
      },
      cardLift: (id, on) => {
        if (on) {
          const card = cardsRef.current.find((c) => c.id === id)
          if (!card) return
          // a frame carries the posters lying inside it
          const kids = card.kind === 'frame'
            ? cardsRef.current.filter((c) => c.id !== id && c.x >= card.x && c.y >= card.y && c.x + c.w <= card.x + card.w && c.y + c.h <= card.y + card.h).map((c) => c.id)
            : []
          moving.current = { id, ids: [id, ...kids] }
          if (card.kind === 'page') {
            const top = cardsRef.current.reduce((m, c) => Math.max(m, c.z), 0) + 1
            cardsRef.current = cardsRef.current.map((c) => (c.id === id ? { ...c, z: top } : c))
          }
          setLifted(id)
        } else setLifted('')
      },
      cardMove: (id, dx, dy) => {
        const m = moving.current
        if (!m || m.id !== id) return
        const ids = new Set(m.ids)
        cardsRef.current = cardsRef.current.map((c) => (ids.has(c.id) ? { ...c, x: c.x + dx, y: c.y + dy } : c))
        for (const cid of ids) {
          const c = cardsRef.current.find((x) => x.id === cid)
          const node = worldEl.current?.querySelector<HTMLElement>(`[data-card="${CSS.escape(cid)}"]`)
          if (c && node) { node.style.left = `${c.x}px`; node.style.top = `${c.y}px` }
        }
      },
      cardDrop: (id) => {
        const m = moving.current
        moving.current = null
        if (!m || m.id !== id) return
        const ids = new Set(m.ids)
        const changed = cardsRef.current.filter((c) => ids.has(c.id)).map((c) => ({ ...c, updatedAt: new Date().toISOString() }))
        setCards(cardsRef.current.slice())
        void putCards(changed)
      },
      dive: (id) => diveInto(id),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, boardId])

  // the gesture code asks "is a page open?" at touch time; keep the latest answer in a ref
  const diveIdRef = useRef<string | undefined>(diveId)
  diveIdRef.current = diveId

  // ---- diving in and rising out
  const diveInto = (cardId: string) => {
    const card = cardsRef.current.find((c) => c.id === cardId)
    if (!card?.pageId) return
    returnCam.current = cam.current
    fly(fitRect(card, size(), 0), 420, () => go(`/b/${boardId}/p/${card.pageId}`))
  }
  const rise = () => go(`/b/${boardId}`)

  const wasDiving = useRef(false)
  useEffect(() => {
    if (!ready) return
    if (diveId && !wasDiving.current) {
      // arrived by a link: put the camera on the page's poster so rising comes back to it
      const card = cardsRef.current.find((c) => c.pageId === diveId)
      if (card && !returnCam.current) { returnCam.current = fitRect(card, size(), 140); setCam(fitRect(card, size(), 0)) }
    }
    if (!diveId && wasDiving.current) {
      const back = returnCam.current
      returnCam.current = null
      if (back) { fly(back, 420) }
    }
    wasDiving.current = !!diveId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diveId, ready])

  useEffect(() => {
    if (!diveId) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !(e.target as HTMLElement).closest('input, textarea, [contenteditable]')) rise() }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diveId])

  // ---- importing: the new poster drops onto the middle of the view
  async function addPoster(page: Page) {
    const have = cardsRef.current.find((c) => c.pageId === page.id)
    pagesRef.current.set(page.id, { ...page, notes: await countAnnotations(page.id) })
    if (have) { fly(fitRect(have, size(), 120)); setCards(cardsRef.current.slice()); return }
    const v = viewRect(cam.current, size())
    const now = new Date().toISOString()
    const z = cardsRef.current.reduce((m, c) => Math.max(m, c.z), 0) + 1
    const card: Card = { id: pageCardId(boardId, page.id), boardId, kind: 'page', pageId: page.id, x: v.x + v.w / 2 - PAGE_W / 2, y: v.y + v.h / 2 - PAGE_H / 2, w: PAGE_W, h: PAGE_H, z, createdAt: now, updatedAt: now }
    cardsRef.current = [...cardsRef.current, card]
    setCards(cardsRef.current.slice())
    setFresh(card.id)
    setTimeout(() => setFresh(''), 600)
    await putCards([card])
  }
  async function run(job: () => Promise<Page>) {
    setError('')
    try { await addPoster(await job()) } catch (e) { setError(e instanceof Error ? e.message : 'Import failed.') } finally { setBusy('') }
  }
  const onImport = (e: Event) => {
    e.preventDefault()
    if (!url.trim() || busy) return
    const u = url.trim()
    setUrl('')
    void run(() => importUrl(u, defaultWidth.value, appKey.value, setBusy))
  }
  const onFile = (e: Event) => {
    const input = e.target as HTMLInputElement
    const f = input.files?.[0]
    input.value = ''
    if (f) { setBusy('Opening file…'); void run(() => importFile(f, defaultWidth.value)) }
  }
  const toggleWorld = () => { const next = world === 'night' ? 'day' : 'night'; setWorld(next); void setSetting('world', next) }

  // ---- what to draw: only the cards near the view, each at the level of detail its size on screen deserves
  const vp = size()
  const c = cam.current
  const near = visible(cardsRef.current, viewRect(c, vp))
  const frames = near.filter((k) => k.kind === 'frame')
  const posters = near.filter((k) => k.kind === 'page' && pagesRef.current.has(k.pageId ?? ''))
  const count = (f: Card) => cardsRef.current.filter((k) => k.kind === 'page' && k.x >= f.x && k.y >= f.y && k.x + k.w <= f.x + f.w && k.y + k.h <= f.y + f.h).length
  const hue = board?.hue ?? 210

  return (
    <div ref={root} class="atlas" data-world={world} style={{ '--base-hue': String(hue), '--hue': String(hue) }} aria-label="Your pages on the desk">
      <div ref={worldEl} class={`world${diveId ? ' hidden' : ''}`}>
        {frames.map((f) => (
          <section key={f.id} class="card frame" data-card={f.id} style={{ left: `${f.x}px`, top: `${f.y}px`, width: `${f.w}px`, height: `${f.h}px`, zIndex: '0' }}>
            <h2 class="frame-label" data-handle>{f.text}<small>{count(f)}</small></h2>
          </section>
        ))}
        {posters.map((k) => {
          const lod = levelFor(k.w * c.z, levels.current.get(k.id))
          levels.current.set(k.id, lod)
          return <PosterCard key={k.id} card={k} row={pagesRef.current.get(k.pageId!)!} lod={lod} lifted={lifted === k.id} fresh={fresh === k.id} />
        })}
      </div>

      {ready && cardsRef.current.length === 0 && (
        <div class="empty"><h2>An empty desk</h2><p>Paste a link below, and its page lands here as a poster you can mark up.</p></div>
      )}

      <div class="orb glass" data-chrome><span class="dot" />{board?.name ?? 'Home'}<small>desk</small></div>

      <div class="dock glass" data-chrome>
        <form onSubmit={onImport}>
          <input type="text" inputMode="url" placeholder="Paste a link to add a page" aria-label="Web address" value={url} onInput={(e) => setUrl((e.target as HTMLInputElement).value)} autocapitalize="off" autocorrect="off" spellcheck={false} />
          <button class="go" type="submit" aria-label="Add this page" disabled={!!busy}><Ico d={ICONS.go} /></button>
        </form>
        <span class="sep" />
        <label class="btn" aria-label="Open a saved page file" title="Open a saved .html file"><Ico d={ICONS.file} /><input type="file" accept=".html,.htm,text/html" hidden onChange={onFile} /></label>
        <button type="button" aria-label="Show everything" title="Show everything (0)" onClick={() => fitAll()}><Ico d={ICONS.fit} /></button>
        <span class="sep hide-s" />
        <button type="button" class="hide-s" aria-label="Classic shelf" title="The classic shelf view" onClick={() => go('/shelf')}><Ico d={ICONS.shelf} /></button>
        <button type="button" aria-label="Settings" onClick={() => go('/settings')}><Ico d={ICONS.gear} /></button>
        <button type="button" aria-label={world === 'night' ? 'Switch to day desk' : 'Switch to night desk'} onClick={toggleWorld}><Ico d={world === 'night' ? ICONS.sun : ICONS.moon} /></button>
      </div>

      {(busy || error) && <div class={`busy glass${error ? ' error' : ''}`} data-chrome role={error ? 'alert' : 'status'} onClick={() => setError('')}>{error || busy}</div>}

      {diveId && (
        <>
          <div class="dive"><Reader key={diveId} pageId={diveId} /></div>
          <button class="rise glass" data-chrome aria-label="Back to the desk" title="Back to the desk (Esc)" onClick={rise}><Ico d={ICONS.rise} /></button>
        </>
      )}
    </div>
  )
}
