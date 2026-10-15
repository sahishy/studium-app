import { useCallback, useEffect, useState } from 'react'
import { request } from '../../shared/services/apiService'

const localTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

// The streak board drives both the tooltip's week strip and the notification dot on the Topbar
// flame. A short shared cache lets page headers reuse the same board.
const useStreak = (userId) => {

    const [board, setBoard] = useState(null)
    const [loading, setLoading] = useState(true)
    const [claiming, setClaiming] = useState(false)

    const refresh = useCallback(async ({ fresh = true } = {}) => {

        if(!userId) {
            setLoading(false)
            return
        }

        try {
            setBoard(await request({ path: `/v1/streak?timeZone=${encodeURIComponent(localTimeZone())}`, fresh }))
        } catch {
            setBoard(null)
        } finally {
            setLoading(false)
        }

    }, [userId])

    useEffect(() => { refresh({ fresh: false }) }, [refresh])

    const claim = useCallback(async () => {

        setClaiming(true)

        try {
            const result = await request({
                path: '/v1/streak/claim',
                method: 'POST',
                body: { timeZone: localTimeZone() },
            })

            setBoard((current) => ({
                ...(current ?? {}),
                ...result,
                claimedToday: true,
                claimable: false,
            }))

            return result
        } finally {
            setClaiming(false)
        }

    }, [])

    return { board, loading, claiming, claim, refresh }
}

export default useStreak
