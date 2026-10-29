import { actions, canRedo, canUndo, color, drawWithFinger, mode, PALETTE, size, tool, trayEdge, type Edge, type Tool } from './state.ts'

const TOOLS: Array<[Tool, string, string]> = [['pen', '✎', 'Pen'], ['highlighter', '▬', 'Highlighter'], ['eraser', '⌫', 'Eraser']]

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
  return (
    <div class={`tray edge-${trayEdge.value}`} role="toolbar" aria-label="Markup tools">
      <button class="grip" aria-label="Move toolbar" onPointerDown={dragTray}>⋮⋮</button>
      <button class={markup ? 'on' : ''} aria-label={markup ? 'Markup mode, tap for reading mode' : 'Reading mode, tap for markup mode'} onClick={() => (mode.value = markup ? 'read' : 'markup')}>
        {markup ? '✍' : '☰'}
      </button>
      {markup && (
        <>
          {TOOLS.map(([t, glyph, label]) => (
            <button key={t} class={tool.value === t ? 'on' : ''} aria-label={label} aria-pressed={tool.value === t} onClick={() => (tool.value = t)}>{glyph}</button>
          ))}
          <span class="sep" />
          {PALETTE.map((c) => (
            <button key={c} class={`swatch ${color.value === c ? 'on' : ''}`} style={{ background: c }} aria-label={`Colour ${c}`} aria-pressed={color.value === c} onClick={() => (color.value = c)} />
          ))}
          <label class="swatch custom" aria-label="Custom colour">
            <input type="color" value={color.value} onInput={(e) => (color.value = (e.target as HTMLInputElement).value)} />
          </label>
          <span class="sep" />
          {([2, 4, 8] as const).map((s) => (
            <button key={s} class={size.value === s ? 'on' : ''} aria-label={`Size ${s}`} aria-pressed={size.value === s} onClick={() => (size.value = s)}>
              <i class="dot" style={{ width: s * 2 + 4 + 'px', height: s * 2 + 4 + 'px' }} />
            </button>
          ))}
          <span class="sep" />
          <button disabled={!canUndo.value} aria-label="Undo" onClick={() => actions.undo()}>↶</button>
          <button disabled={!canRedo.value} aria-label="Redo" onClick={() => actions.redo()}>↷</button>
          <button class={drawWithFinger.value ? 'on' : ''} aria-label="Draw with finger" aria-pressed={drawWithFinger.value} onClick={() => (drawWithFinger.value = !drawWithFinger.value)}>☝</button>
        </>
      )}
    </div>
  )
}
