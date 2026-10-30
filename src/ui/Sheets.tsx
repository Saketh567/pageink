/**
 * Bottom sheets for page options and for creating or editing a collection.
 */
import type { ComponentChildren } from 'preact'
import { useState } from 'preact/hooks'
import { normalizeTags, type Row } from '../store/organize.ts'
import { deleteCollection, deletePage, patchPage, putCollection } from '../store/repo.ts'
import type { Collection } from '../store/schema.ts'
import { Icon } from './icons.tsx'
import { ACCENTS, WIDTHS } from './state.ts'

function Sheet({ title, onClose, children }: { title: string; onClose(): void; children: ComponentChildren }) {
  return (
    <div class="sheet-backdrop" onClick={onClose}>
      <div class="sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  )
}

interface PageSheetProps { row: Row; collections: Collection[]; onChanged(): void; onClose(): void }

/** Everything about one page in one place: name, collection, tags, pin, delete. Changes save as you make them. */
export function PageSheet({ row, collections, onChanged, onClose }: PageSheetProps) {
  const [title, setTitle] = useState(row.title)
  const [tags, setTags] = useState(row.tags)
  const [draft, setDraft] = useState('')
  const [collectionId, setCollectionId] = useState(row.collectionId)
  const [pinned, setPinned] = useState(!!row.pinned)
  const [layout, setLayout] = useState(row.layoutWidth)

  const save = async (patch: Parameters<typeof patchPage>[1]) => {
    await patchPage(row.id, patch)
    onChanged()
  }
  const commitTitle = () => {
    const t = title.trim()
    if (t && t !== row.title) void save({ title: t, updatedAt: new Date().toISOString() })
    else setTitle(row.title)
  }
  const addTags = () => {
    const next = normalizeTags([...tags, draft].join(' '))
    setDraft('')
    if (next.join() !== tags.join()) { setTags(next); void save({ tags: next }) }
  }
  const removeTag = (t: string) => {
    const next = tags.filter((x) => x !== t)
    setTags(next)
    void save({ tags: next })
  }

  return (
    <Sheet title="Page options" onClose={onClose}>
      <div>
        <label class="lbl" for="ptitle">Title</label>
        <input id="ptitle" class="field" value={title} onInput={(e) => setTitle((e.target as HTMLInputElement).value)} onBlur={commitTitle} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
        {row.url && <p class="url">{row.url}</p>}
      </div>

      <div>
        <label class="lbl" for="playout">Layout</label>
        <select id="playout" class="field" value={layout} onChange={(e) => { const v = Number((e.target as HTMLSelectElement).value); setLayout(v); void save({ layoutWidth: v }) }}>
          {WIDTHS.map(([w, label]) => <option key={w} value={w}>{label}</option>)}
        </select>
        <p class="hint" style={{ marginTop: '6px' }}>Auto lays the page out for your screen, like the original site. Fixed widths are shrunk or stretched to fit.</p>
      </div>

      <div>
        <label class="lbl">Collection</label>
        <div class="row" role="group" aria-label="Collection">
          <button class="chip" aria-pressed={!collectionId} onClick={() => { setCollectionId(undefined); void save({ collectionId: undefined }) }}>None</button>
          {collections.map((c) => (
            <button key={c.id} class="chip" aria-pressed={collectionId === c.id} onClick={() => { setCollectionId(c.id); void save({ collectionId: c.id }) }}>
              <i class="dotc" style={{ background: c.color }} />{c.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label class="lbl" for="ptags">Tags</label>
        <div class="row" style={{ marginBottom: '8px' }}>
          {tags.map((t) => <span key={t} class="chip">#{t}<button aria-label={`Remove tag ${t}`} onClick={() => removeTag(t)}><Icon name="x" /></button></span>)}
        </div>
        <input id="ptags" class="field" placeholder="Add tags, separated by commas" value={draft} autocapitalize="off"
          onInput={(e) => setDraft((e.target as HTMLInputElement).value)} onBlur={addTags}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ',') && (e.preventDefault(), addTags())} />
      </div>

      <p class="hint">Offline copy: {row.offline === 'complete' ? 'pictures, styles and fonts are saved with this page.' : row.offline === 'partial' ? 'partly saved. Open the page and use the download button to try again.' : row.url ? 'not saved yet. It is saved the next time you open the page.' : 'not applicable to a file.'}</p>
      <div class="row">
        <button class="btn" aria-pressed={pinned} onClick={() => { setPinned(!pinned); void save({ pinned: !pinned }) }}>
          <Icon name="star" />{pinned ? 'Pinned' : 'Pin to top'}
        </button>
        {/^https?:\/\//i.test(row.url) && <a class="btn" href={row.url} target="_blank" rel="noopener noreferrer"><Icon name="link" />Open original</a>}
        <button class="btn danger" onClick={() => {
          if (confirm(`Delete “${row.title}” and all its marks?`)) void deletePage(row.id).then(() => { onChanged(); onClose() })
        }}>Delete</button>
      </div>
      <button class="btn primary" onClick={onClose}>Done</button>
    </Sheet>
  )
}

interface CollectionSheetProps { collection?: Collection; nextOrder: number; onChanged(): void; onClose(): void }

export function CollectionSheet({ collection, nextOrder, onChanged, onClose }: CollectionSheetProps) {
  const [name, setName] = useState(collection?.name ?? '')
  const [color, setColor] = useState(collection?.color ?? ACCENTS[nextOrder % ACCENTS.length])
  const save = async () => {
    const n = name.trim()
    if (!n) return
    await putCollection({ id: collection?.id ?? crypto.randomUUID(), name: n, color, order: collection?.order ?? nextOrder, createdAt: collection?.createdAt ?? new Date().toISOString() })
    onChanged()
    onClose()
  }
  return (
    <Sheet title={collection ? 'Edit collection' : 'New collection'} onClose={onClose}>
      <div>
        <label class="lbl" for="cname">Name</label>
        <input id="cname" class="field" value={name} autoFocus placeholder="For example: Competitor research"
          onInput={(e) => setName((e.target as HTMLInputElement).value)} onKeyDown={(e) => e.key === 'Enter' && void save()} />
      </div>
      <div>
        <label class="lbl">Colour</label>
        <div class="swatches" role="group" aria-label="Collection colour">
          {ACCENTS.map((c) => <button key={c} class="sw" style={{ background: c }} aria-label={`Colour ${c}`} aria-pressed={color === c} onClick={() => setColor(c)} />)}
        </div>
      </div>
      <div class="row">
        {collection && (
          <button class="btn danger" onClick={() => {
            if (confirm(`Delete the collection “${collection.name}”? Its pages are kept.`)) void deleteCollection(collection.id).then(() => { onChanged(); onClose() })
          }}>Delete</button>
        )}
        <button class="btn primary" style={{ marginLeft: 'auto' }} disabled={!name.trim()} onClick={() => void save()}>{collection ? 'Save' : 'Create'}</button>
      </div>
    </Sheet>
  )
}
