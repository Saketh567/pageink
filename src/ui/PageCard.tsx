/**
 * One saved page in the library, as a card or a list row.
 */
import { useState } from 'preact/hooks'
import type { Row } from '../store/organize.ts'
import type { Collection } from '../store/schema.ts'
import { archiveProgress } from '../archive/progress.ts'
import { Icon } from './icons.tsx'

/** Stable colour per site, so cards without a cover image still look distinct. */
function gradientFor(key: string): string {
  let h = 0
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) % 360
  return `linear-gradient(135deg, hsl(${h} 62% 46%), hsl(${(h + 48) % 360} 66% 34%))`
}

const host = (r: Row) => {
  try { return r.url ? new URL(r.url).hostname.replace(/^www\./, '') : r.siteOrigin === 'file:' ? 'Saved file' : r.siteOrigin } catch { return 'Saved page' } // a bad address must not break the whole library
}

/** Short status of the saved copy: counting while it saves, then "Offline" or "Partly offline". */
function offlineLabel(row: Row): string {
  const p = archiveProgress.value[row.id]
  if (p) return `Saving ${p.saved}/${p.total}`
  return row.offline === 'complete' ? 'Saved offline' : row.offline === 'partial' ? 'Partly offline' : ''
}

interface Props {
  row: Row
  collection?: Collection
  onOpen(): void
  onMore(): void
  onPin(): void
}

export function PageCard({ row, collection, onOpen, onMore, onPin }: Props) {
  const [coverFailed, setCoverFailed] = useState(false)
  const touched = row.openedAt ?? row.updatedAt
  return (
    <article class="pagecard" draggable onDragStart={(e) => { e.dataTransfer?.setData('application/x-pageink-page', row.id); e.dataTransfer && (e.dataTransfer.effectAllowed = 'move') }}>
      <button class="cover" tabIndex={-1} aria-hidden="true" onClick={onOpen} style={{ background: gradientFor(row.siteOrigin) }}>
        <span class="initial">{(row.title.trim()[0] ?? '?').toUpperCase()}</span>
        {row.cover && !coverFailed && <img src={row.cover} alt="" loading="lazy" referrerpolicy="no-referrer" onError={() => setCoverFailed(true)} />}
      </button>
      <button class="overlay more" aria-label={`Options for ${row.title}`} onClick={onMore}><Icon name="more" /></button>
      <button class="overlay pin" aria-label={row.pinned ? `Unpin ${row.title}` : `Pin ${row.title}`} aria-pressed={!!row.pinned} onClick={onPin}><Icon name="star" /></button>
      <button class="body" aria-label={`Open ${row.title}`} onClick={onOpen}>
        <span class="ptitle">{row.title}</span>
        <span class="host">{host(row)}</span>
        {row.tags.length > 0 && (
          <span class="tags">
            {row.tags.slice(0, 3).map((t) => <span key={t} class="chip">#{t}</span>)}
            {row.tags.length > 3 && <span class="chip">+{row.tags.length - 3}</span>}
          </span>
        )}
        <span class="meta">
          {collection && <span class="collbadge"><i class="dotc" style={{ background: collection.color }} />{collection.name}</span>}
          <span>{new Date(touched).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
          <span>{row.notes} mark{row.notes === 1 ? '' : 's'}</span>
          {offlineLabel(row) && <span class="offline">{offlineLabel(row)}</span>}
        </span>
      </button>
    </article>
  )
}
