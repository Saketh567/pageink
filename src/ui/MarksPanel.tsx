/**
 * The side panel listing every mark on the page.
 */
import { useState } from 'preact/hooks'
import { MEANINGS, studySheet, tidy, type Meaning } from '../export/study-sheet.ts'
import { Icon } from './icons.tsx'
import { currentPage, marks, marksApi, openNote, panelOpen, spotlightId } from './state.ts'

/** Every highlight and note on the page in reading order: filter, search, jump to, spotlight, and share as a study sheet. */
export function MarksPanel() {
  const [filter, setFilter] = useState<Meaning | ''>('')
  const [query, setQuery] = useState('')
  const [toast, setToast] = useState('')
  if (!panelOpen.value) return null

  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const textOf = (m: (typeof marks.value)[number]) => (m.a.kind === 'highlight' ? tidy(m.a.anchor.text?.quote.exact ?? '') : m.a.note?.text ?? '')
  const shown = marks.value.filter((m) => {
    if (filter && m.a.meaning !== filter) return false
    const hay = `${textOf(m)} ${m.a.note?.text ?? ''}`.toLowerCase()
    return words.every((w) => hay.includes(w))
  })
  const found = shown.filter((m) => !m.orphaned)
  const lost = shown.filter((m) => m.orphaned)

  async function share() {
    const page = currentPage.value
    if (!page) return
    const md = studySheet(page, marks.value)
    try {
      if (navigator.share) await navigator.share({ title: page.title, text: md })
      else { await navigator.clipboard.writeText(md); setToast('Study sheet copied') }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') { await navigator.clipboard?.writeText(md).catch(() => {}); setToast('Study sheet copied') }
    }
    setTimeout(() => setToast(''), 2500)
  }

  const row = (m: (typeof marks.value)[number]) => {
    const label = MEANINGS.find((x) => x[0] === m.a.meaning)?.[1] ?? 'Note'
    const body = textOf(m) || 'Empty note'
    return (
      <li key={m.a.id} class="markrow">
        <button class="markmain" aria-label={`Go to ${label}: ${body.slice(0, 60)}`} onClick={() => (m.a.kind === 'note' ? (openNote.value = m.a.id, marksApi.reveal(m.a.id)) : marksApi.reveal(m.a.id))}>
          <i class="dotc" style={{ background: m.a.color }} />
          <span class="marktext">
            <span class="quote">{m.a.kind === 'highlight' ? `“${body}”` : body}</span>
            {m.a.kind === 'highlight' && m.a.note?.text && <span class="marknote">{m.a.note.text}</span>}
            <small>{label}{m.orphaned ? ' · not found on the page' : ''}</small>
          </span>
        </button>
        {m.a.kind === 'highlight' && !m.orphaned && (
          <button class="btn icon sm" aria-label="Spotlight this highlight" aria-pressed={spotlightId.value === m.a.id} onClick={() => marksApi.spotlight(spotlightId.value === m.a.id ? null : m.a.id)}>◎</button>
        )}
        <button class="btn icon sm" aria-label="Delete mark" onClick={() => marksApi.remove(m.a.id)}><Icon name="x" /></button>
      </li>
    )
  }

  return (
    <aside class="panel" aria-label="Marks">
      <header class="panelhead">
        <h2>Marks <span>{marks.value.length}</span></h2>
        <button class="btn icon" aria-label="Close marks" onClick={() => (panelOpen.value = false)}><Icon name="x" /></button>
      </header>
      <div class="search">
        <Icon name="search" />
        <input class="field" type="search" placeholder="Search your marks" aria-label="Search marks" value={query} onInput={(e) => setQuery((e.target as HTMLInputElement).value)} />
      </div>
      <div class="row chips" role="group" aria-label="Filter by meaning">
        <button class="chip" aria-pressed={!filter} onClick={() => setFilter('')}>All</button>
        {MEANINGS.map(([id, label, hex]) => (
          <button key={id} class="chip" aria-pressed={filter === id} onClick={() => setFilter(filter === id ? '' : id)}><i class="dotc" style={{ background: hex }} />{label}</button>
        ))}
      </div>
      {marks.value.length === 0 && <p class="empty small"><strong>No marks yet</strong>Choose Mark text or Note in the toolbar, then drag over words or tap the page.</p>}
      {marks.value.length > 0 && shown.length === 0 && <p class="empty small"><strong>Nothing matches</strong>Try another search or meaning.</p>}
      <ul class="marklist">{found.map(row)}</ul>
      {lost.length > 0 && (
        <>
          <h3 class="attn">Needs attention</h3>
          <p class="hint">These words could not be found on the page any more (it may have changed).</p>
          <ul class="marklist">{lost.map(row)}</ul>
        </>
      )}
      <footer class="panelfoot">
        <button class="btn primary" disabled={!marks.value.length} onClick={() => void share()}>Share study sheet</button>
        {toast && <span class="hint" role="status">{toast}</span>}
      </footer>
    </aside>
  )
}
