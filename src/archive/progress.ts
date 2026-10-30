/** Live progress of saving pages for offline, by page id, so cards and the reader can show "12 of 40". Cleared when a page is done. */
import { signal } from '@preact/signals'

export const archiveProgress = signal<Record<string, { saved: number; total: number }>>({})
