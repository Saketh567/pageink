import type { Annotation, Page } from '../store/schema.ts'

export const MEANINGS = [
  ['important', 'Important', '#ffd60a'],
  ['question', 'Question', '#0a84ff'],
  ['idea', 'Idea', '#34c759'],
  ['confusing', 'Confusing', '#ff9500'],
  ['issue', 'Issue', '#ff3b30'],
] as const
export type Meaning = (typeof MEANINGS)[number][0]

export interface Mark { a: Annotation; orphaned: boolean; x?: number; y: number }

const quote = (s: string) => s.trim().split('\n').map((l) => `> ${l}`).join('\n')
/** One line, without a leading footnote marker like "1]" or "[2]" (older highlights were saved with one). */
export const tidy = (s: string) => s.replace(/\s+/g, ' ').trim().replace(/^(?:\[?\w{1,4}\]\s*)+/, '')

/** Your highlights and notes as Markdown, grouped by meaning, ready to paste or share. */
export function studySheet(page: Pick<Page, 'title' | 'url' | 'capturedAt'>, marks: Mark[]): string {
  const usable = marks.filter((m) => m.a.kind === 'highlight' || m.a.kind === 'note')
  const lines = [`# ${page.title}`, `${page.url ? page.url + ' · ' : ''}captured ${page.capturedAt.slice(0, 10)} · ${usable.length} mark${usable.length === 1 ? '' : 's'}`, '']
  const section = (title: string, items: Mark[]) => {
    if (!items.length) return
    lines.push(`## ${title}`, '')
    for (const m of items) {
      const text = m.a.kind === 'highlight' ? m.a.anchor.text?.quote.exact : undefined
      const note = m.a.note?.text?.trim()
      if (text) lines.push(quote(tidy(text)))
      if (note) lines.push(text ? note : `Note: ${note}`)
      if (!text && !note) lines.push('(empty note)')
      lines.push('')
    }
  }
  for (const [id, label] of MEANINGS) section(label, usable.filter((m) => m.a.meaning === id && !m.orphaned))
  section('Other notes', usable.filter((m) => !m.a.meaning && !m.orphaned))
  section('Needs attention (could not be found on the page)', usable.filter((m) => m.orphaned))
  return lines.join('\n').trimEnd() + '\n'
}
