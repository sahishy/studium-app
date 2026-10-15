import { useCallback, useEffect, useState } from 'react'
import { request } from '../../shared/services/apiService'

// Loads the SAT mastery board. Kept as a hook rather than a context because only the Progress
// screen reads it, and it changes only when a match settles.
const useMastery = (userId) => {

    const [board, setBoard] = useState(null)
    const [loading, setLoading] = useState(true)

    const refresh = useCallback(async ({ fresh = true } = {}) => {

        if(!userId) {
            setLoading(false)
            return
        }

        try {
            setBoard(await request({ path: '/v1/mastery', fresh }))
        } catch {
            // The skill web draws its own empty state, so a failed load degrades to "no data"
            // rather than taking the page down with it. A board that already loaded is kept,
            // though: wiping it made a transient failure look like a student with no skill
            // history at all, and the web had nothing to redraw when the next load succeeded,
            // so the board it already has is left in place.
        } finally {
            setLoading(false)
        }

    }, [userId])

    useEffect(() => { refresh({ fresh: false }) }, [refresh])

    return { board, loading, refresh }
}

export default useMastery
