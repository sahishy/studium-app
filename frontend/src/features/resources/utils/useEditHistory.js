import { useCallback, useMemo, useState } from 'react'
import { canRedo, canUndo, emptyHistory, record, redo, undo } from './editHistory.js'

// A thin React wrapper over the pure history rules in editHistory.js.
const useEditHistory = (initial) => {

    const [history, setHistory] = useState(() => emptyHistory(initial))

    const change = useCallback((next) => {
        setHistory((current) => record(current, typeof next === 'function' ? next(current.present) : next))
    }, [])

    // Replaces the content without recording a step — used when loading, where there is no
    // earlier state worth returning to.
    const reset = useCallback((value) => setHistory(emptyHistory(value)), [])

    return useMemo(() => ({
        state: history.present,
        change,
        reset,
        undo: () => setHistory(undo),
        redo: () => setHistory(redo),
        canUndo: canUndo(history),
        canRedo: canRedo(history),
    }), [history, change, reset])
}

export default useEditHistory
