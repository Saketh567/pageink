/**
 * Reads and writes boards, the cards lying on them and the links between cards (the Atlas). Kept apart from repo.ts, which
 * holds pages, snapshots and annotations. Cards point at pages and marks; they never copy them.
 */
import { getDb } from './db.ts'
import type { Board, Camera, Card, ID, Link } from './schema.ts'

export async function listBoards(): Promise<Board[]> {
  return (await (await getDb()).getAllFromIndex('boards', 'order')) as Board[]
}
export async function getBoard(id: ID) {
  return (await getDb()).get('boards', id)
}
export async function putBoard(b: Board) {
  await (await getDb()).put('boards', b)
}
/** Remember where the camera was. Only this field is written, so it can never undo a rename made meanwhile. */
export async function saveCamera(id: ID, camera: Camera) {
  const b = await getBoard(id)
  if (b) await putBoard({ ...b, camera })
}

export async function listCards(boardId: ID): Promise<Card[]> {
  return (await getDb()).getAllFromIndex('cards', 'boardId', boardId)
}
/** Adds or replaces cards in one transaction. */
export async function putCards(cards: Card[]) {
  const tx = (await getDb()).transaction('cards', 'readwrite')
  await Promise.all([...cards.map((c) => tx.store.put(c)), tx.done])
}
/** Change some fields of a card (a move, a resize). Only those fields are written. */
export async function patchCard(id: ID, patch: Partial<Card>) {
  const db = await getDb()
  const c = await db.get('cards', id)
  if (c) await db.put('cards', { ...c, ...patch, updatedAt: new Date().toISOString() })
}
/** Deletes cards and every link that touches them. */
export async function deleteCards(ids: ID[]) {
  const tx = (await getDb()).transaction(['cards', 'links'], 'readwrite')
  const dead = new Set(ids)
  for (const id of ids) tx.objectStore('cards').delete(id)
  for (const l of await tx.objectStore('links').getAll()) if (dead.has(l.from) || dead.has(l.to)) tx.objectStore('links').delete(l.id)
  await tx.done
}
export async function listLinks(boardId: ID): Promise<Link[]> {
  return (await getDb()).getAllFromIndex('links', 'boardId', boardId)
}
