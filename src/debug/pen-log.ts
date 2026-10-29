/** ?debug=1: on-screen pointer log (type, pressure, tilt, coalesced/predicted counts, Hz) plus the eruda console. */
export function enablePenLog() {
  if (new URLSearchParams(location.search).get('debug') !== '1') return
  void import('eruda').then((m) => m.default.init())

  const box = document.createElement('pre')
  box.setAttribute('aria-hidden', 'true')
  box.style.cssText = 'position:fixed;left:8px;top:8px;z-index:99999;margin:0;padding:6px 8px;max-width:46vw;max-height:40vh;overflow:hidden;background:#000c;color:#7CFC8A;font:11px/1.3 ui-monospace,monospace;pointer-events:none;border-radius:8px;white-space:pre'
  document.body.append(box)

  const lines: string[] = []
  const stamps: number[] = []
  addEventListener('pointermove', (e) => {
    stamps.push(e.timeStamp)
    while (stamps.length && e.timeStamp - stamps[0] > 1000) stamps.shift()
    const ev = e as PointerEvent & { altitudeAngle?: number; azimuthAngle?: number }
    lines.unshift(
      `${e.pointerType} p=${e.pressure.toFixed(2)} tilt=${e.tiltX},${e.tiltY}` +
        (ev.altitudeAngle !== undefined ? ` alt=${ev.altitudeAngle.toFixed(2)} az=${(ev.azimuthAngle ?? 0).toFixed(2)}` : '') +
        ` co=${e.getCoalescedEvents?.().length ?? '-'} pr=${e.getPredictedEvents?.().length ?? '-'} b=${e.buttons}`,
    )
    lines.length = Math.min(lines.length, 50)
    box.textContent = `${stamps.length} Hz\n` + lines.join('\n')
  })
}
