import type { Page } from '../store/schema.ts'
import { storePage } from './import-url.ts'

/** Import a saved .html file (for example from Files or a "Save page" export). */
export async function importFile(file: File, layoutWidth: number): Promise<Page> {
  const html = await file.text()
  if (!/<\w+/.test(html)) throw new Error('That file does not look like an HTML page.')
  // the page's own title is the better name; the file name is only the fallback
  const title = new DOMParser().parseFromString(html, 'text/html').title.trim() || file.name.replace(/\.html?$/i, '')
  return storePage({ html, url: '', title, method: 'file', layoutWidth })
}
