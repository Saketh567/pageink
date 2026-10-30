import { MEANINGS } from '../export/study-sheet.ts'
import { revealHidden } from '../viewer/widgets.ts'
import { actions, activeViewer, canRedo, canUndo, color, drawWithFinger, go, margin, marks, meaning, mode, notice, panelOpen, PALETTE, size, tool, trayEdge, type Edge, type Tool } from './state.ts'

// Line icons (Lucide, ISC licence), 24x24, stroke only.
const ICONS = {
  back: ['m15 18-6-6 6-6'],
  pen: ['M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z', 'm15 5 4 4'],
  highlighter: ['m9 11-6 6v3h9l3-3', 'm22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4'],
  eraser: ['m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21', 'M22 21H7', 'm5 11 9 9'],
  undo: ['M3 7v6h6', 'M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13'],
  redo: ['M21 7v6h-6', 'M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7'],
  finger: ['M22 14a8 8 0 0 1-8 8', 'M18 11v-1a2 2 0 0 0-2-2a2 2 0 0 0-2 2', 'M14 10V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v1', 'M10 9.5V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v10', 'M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15'],
  text: ['M5 4h1a3 3 0 0 1 3 3 3 3 0 0 1 3-3h1', 'M13 20h-1a3 3 0 0 1-3-3 3 3 0 0 1-3 3H5', 'M5 16H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h1', 'M13 8h7a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-7', 'M9 7v10'],
  note: ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z', 'M7 8h10', 'M7 12h6'],
  list: ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3 6h.01', 'M3 12h.01', 'M3 18h.01'],
  expand: ['m7 15 5 5 5-5', 'm7 9 5-5 5 5'],
  lane: ['M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M15 3v18'],
}

function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {ICONS[name].map((d) => <path key={d} d={d} />)}
    </svg>
  )
}

const TOOLS: Array<[Tool, keyof typeof ICONS, string]> = [
  ['mark', 'text', 'Mark text'], ['note', 'note', 'Note'], ['pen', 'pen', 'Pen'], ['highlighter', 'highlighter', 'Highlighter'], ['eraser', 'eraser', 'Eraser'],
]

/** Opens every dropdown, FAQ and collapsed section on the page at once. */
function expandAll() {
  const v = activeViewer.value
  const doc = v?.iframe.contentDocument
  if (!v || !doc) return
  const n = revealHidden(doc, { expandAll: true })
  v.remeasure()
  notice.value = n ? `Opened ${n} hidden section${n === 1 ? '' : 's'}` : 'Nothing hidden to open'
}

function dragTray(e: PointerEvent) {
  const handle = e.currentTarget as HTMLElement
  handle.setPointerCapture(e.pointerId)
  const up = (u: PointerEvent) => {
    handle.removeEventListener('pointerup', up)
    const d: Array<[Edge, number]> = [
      ['top', u.clientY], ['bottom', innerHeight - u.clientY], ['left', u.clientX], ['right', innerWidth - u.clientX],
    ]
    trayEdge.value = d.sort((a, b) => a[1] - b[1])[0][0]
    try { localStorage.setItem('pageink.tray', trayEdge.value) } catch { /* position just won't persist */ }
  }
  handle.addEventListener('pointerup', up)
}

export function ToolTray() {
  const markup = mode.value === 'markup'
  const t = tool.value
  const anchored = t === 'mark' || t === 'note'
  return (
    <div class={`tray edge-${trayEdge.value}`} role="toolbar" aria-label="Markup tools">
      <div class="grp">
        <button class="grip" aria-label="Move toolbar" onPointerDown={dragTray}>⋮⋮</button>
        <button aria-label="Back to library" onClick={() => go('')}><Icon name="back" /></button>
        <button
          class={markup ? 'on' : ''}
          aria-label={markup ? 'Markup mode, tap for reading mode' : 'Reading mode, tap for markup mode'}
          onClick={() => (mode.value = markup ? 'read' : 'markup')}
        >
          <span class="lbl seg"><b class={markup ? 'on' : ''}>Mark</b><b class={markup ? '' : 'on'}>Read</b></span>
        </button>
      </div>
      {markup && (
        <>
          <div class="grp">
            {TOOLS.map(([id, icon, label]) => (
              <button key={id} class={t === id ? 'on' : ''} aria-label={label} aria-pressed={t === id} onClick={() => (tool.value = id)}>
                <Icon name={icon} />
              </button>
            ))}
          </div>
          {anchored && (
            <div class="grp" role="group" aria-label="Meaning">
              {MEANINGS.map(([id, label, hex]) => (
                <button key={id} class={`swatch ${meaning.value === id ? 'on' : ''}`} style={{ background: hex }} title={label} aria-label={`Meaning ${label}`} aria-pressed={meaning.value === id} onClick={() => (meaning.value = id)} />
              ))}
            </div>
          )}
          {(t === 'pen' || t === 'highlighter') && (
            <>
              <div class="grp">
                {PALETTE.map((c) => (
                  <button key={c} class={`swatch ${color.value === c ? 'on' : ''}`} style={{ background: c }} aria-label={`Colour ${c}`} aria-pressed={color.value === c} onClick={() => (color.value = c)} />
                ))}
                <label class="swatch custom" aria-label="Custom colour">
                  <input type="color" value={color.value} onInput={(e) => (color.value = (e.target as HTMLInputElement).value)} />
                </label>
              </div>
              <div class="grp">
                {([2, 4, 8] as const).map((s) => (
                  <button key={s} class={size.value === s ? 'on' : ''} aria-label={`Size ${s}`} aria-pressed={size.value === s} onClick={() => (size.value = s)}>
                    <i class="dot" style={{ width: s * 2 + 4 + 'px', height: s * 2 + 4 + 'px' }} />
                  </button>
                ))}
              </div>
            </>
          )}
          <div class="grp">
            <button disabled={!canUndo.value} aria-label="Undo" onClick={() => actions.undo()}><Icon name="undo" /></button>
            <button disabled={!canRedo.value} aria-label="Redo" onClick={() => actions.redo()}><Icon name="redo" /></button>
            <button class={drawWithFinger.value ? 'on' : ''} aria-label="Draw with finger" aria-pressed={drawWithFinger.value} onClick={() => (drawWithFinger.value = !drawWithFinger.value)}>
              <Icon name="finger" />
            </button>
          </div>
        </>
      )}
      <div class="grp">
        <button aria-label="Expand all sections" title="Open every dropdown and FAQ" onClick={expandAll}><Icon name="expand" /></button>
        <button class={margin.value ? 'on' : ''} aria-label="Margin lane" aria-pressed={margin.value} onClick={() => (margin.value = !margin.value)}><Icon name="lane" /></button>
        <button class={`withbadge ${panelOpen.value ? 'on' : ''}`} aria-label="Marks" aria-pressed={panelOpen.value} onClick={() => (panelOpen.value = !panelOpen.value)}>
          <Icon name="list" />
          {marks.value.length > 0 && <b class="badge">{marks.value.length}</b>}
        </button>
      </div>
    </div>
  )
}
