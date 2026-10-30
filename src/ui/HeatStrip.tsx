import { activeViewer, marks, marksApi, viewTick } from './state.ts'

/**
 * A thin strip on the right edge: one coloured tick per mark at its place on the whole page, and a window showing
 * what is on screen. Tap a tick to jump there. The strip itself never catches touches, so Pencil strokes at the edge are safe.
 */
export function HeatStrip() {
  void viewTick.value
  const viewer = activeViewer.value
  if (!viewer || !marks.value.length) return null
  const total = Math.max(viewer.docHeight, 1)
  const c = viewer.container
  const top = ((c.scrollTop / viewer.scale) / total) * 100
  const height = ((c.clientHeight / viewer.scale) / total) * 100
  return (
    <div class="heat" aria-label="Marks on this page">
      <i class="heatwin" style={{ top: Math.min(top, 100) + '%', height: Math.min(height, 100) + '%' }} />
      {marks.value.map((m) => (
        <button key={m.a.id} class="tick" style={{ top: (m.y / total) * 100 + '%', background: m.a.color }} aria-label={`Jump to mark ${Math.round((m.y / total) * 100)} percent down the page`} onClick={() => marksApi.reveal(m.a.id)} />
      ))}
    </div>
  )
}
