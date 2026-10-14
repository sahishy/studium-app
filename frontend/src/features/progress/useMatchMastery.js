import { useEffect, useState } from 'react'
import { request } from '../../shared/services/apiService'

// Read the persisted match comparison after the server confirms it has committed the result.
const useMatchMastery = ({ userId, gameId, settled }) => {
    const [state, setState] = useState({ comparison: null, loading: true, error: false })
    useEffect(() => {
        let cancelled = false
        setState({ comparison: null, loading: Boolean(userId && gameId), error: false })
        if(!userId || !gameId || !settled) return () => { cancelled = true }
        request({ path: `/v1/mastery/matches/${encodeURIComponent(gameId)}` })
            .then((result) => {
                if(!cancelled) setState({ comparison: result.comparison ?? null, loading: false, error: Boolean(result.pending) })
            })
            .catch(() => {
                if(!cancelled) setState({ comparison: null, loading: false, error: true })
            })
        return () => { cancelled = true }
    }, [userId, gameId, settled])
    return state
}

export default useMatchMastery
