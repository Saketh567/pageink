import { useEffect, useRef } from 'preact/hooks'
import { MEANINGS } from '../export/study-sheet.ts'
import { activeViewer, marks, marksApi, openNote, viewTick } from './state.ts'

const W = 300

/** The note being edited, floating beside its pin. A real text field, so Scribble can turn handwriting into text. */
export function NoteCard() {
  void viewTick.value // follow the pin while the page scrolls or zooms
  const id = openNote.value
  const viewer = activeViewer.value
  const mark = id ? marks.value.find((m) => m.a.id === id) : undefined
  const field = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { if (id) field.current?.focus() }, [id])
  if (!id || !mark || !viewer) return null

  const pin = viewer.docToClient(mark.x ?? mark.a.anchor.page.x, mark.y)
  const left = Math.min(Math.max(8, pin.x + 20), innerWidth - W - 8)
  const top = Math.min(Math.max(8, pin.y - 14), innerHeight - 260)
  const text = mark.a.note?.text ?? ''
  const close = () => {
    openNote.value = null
    if (!text.trim()) marksApi.remove(id) // an empty note is not worth keeping
  }

  return (
    <div class="notecard" role="dialog" aria-label="Note" style={{ left: left + 'px', top: top + 'px', width: W + 'px' }}>
      <div class="row" role="group" aria-label="Note meaning">
        {MEANINGS.map(([m, label, hex]) => (
          <button key={m} class={`sw small ${mark.a.meaning === m ? 'on' : ''}`} style={{ background: hex }} title={label} aria-label={`Meaning ${label}`} aria-pressed={mark.a.meaning === m} onClick={() => marksApi.setMeaning(id, m)} />
        ))}
      </div>
      <textarea ref={field} rows={4} placeholder="Write a note (handwriting works here too)" value={text} aria-label="Note text"
        onInput={(e) => marksApi.updateNote(id, (e.target as HTMLTextAreaElement).value)} />
      <div class="row end">
        <button class="btn danger" aria-label="Delete note" onClick={() => marksApi.remove(id)}>Delete</button>
        <button class="btn primary" onClick={close}>Done</button>
      </div>
    </div>
  )
}
