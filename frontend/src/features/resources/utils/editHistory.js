// Undo as a plain value: { past, present, future }. Kept free of React so the rules can be
// tested directly, which is the part worth being sure about.

export const LIMIT = 60
export const COALESCE_MS = 600

export const emptyHistory = (present) => ({ past: [], present, future: [], at: 0 })

// Typing a sentence should be one undo step, not forty, so an edit that lands within
// COALESCE_MS of the previous one replaces the top of the stack instead of adding to it.
export const record = (history, value, now = Date.now(), coalesce = true) => {

    if(value === history.present) return history

    const merge = coalesce && history.past.length > 0 && now - history.at < COALESCE_MS

    return {
        past: merge ? history.past : [...history.past, history.present].slice(-LIMIT),
        present: value,
        future: [],
        at: now,
    }
}

export const undo = (history) => {

    if(!history.past.length) return history

    return {
        past: history.past.slice(0, -1),
        present: history.past[history.past.length - 1],
        future: [history.present, ...history.future].slice(0, LIMIT),
        at: 0,
    }
}

export const redo = (history) => {

    if(!history.future.length) return history

    const [next, ...rest] = history.future

    return {
        past: [...history.past, history.present].slice(-LIMIT),
        present: next,
        future: rest,
        at: 0,
    }
}

export const canUndo = (history) => history.past.length > 0

export const canRedo = (history) => history.future.length > 0
