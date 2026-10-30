/**
 * Undo and redo as a stack of commands that have already been applied.
 */
export interface Command { undo(): void; redo(): void }

const CAP = 200

/** Push commands that have already been applied; undo/redo replay them. */
export function createHistory(onChange: () => void = () => {}) {
  const undoStack: Command[] = []
  let redoStack: Command[] = []
  return {
    push(c: Command) {
      undoStack.push(c)
      if (undoStack.length > CAP) undoStack.shift()
      redoStack = []
      onChange()
    },
    undo() {
      const c = undoStack.pop()
      if (!c) return
      c.undo()
      redoStack.push(c)
      onChange()
    },
    redo() {
      const c = redoStack.pop()
      if (!c) return
      c.redo()
      undoStack.push(c)
      onChange()
    },
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
  }
}
