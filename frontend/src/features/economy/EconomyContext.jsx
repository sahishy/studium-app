import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { request, post } from '../../shared/services/apiService'
import { levelUpAnimation } from '../profile/services/xpService'
import { createSnapshotRefresher } from './utils/snapshotRefresh'

const EconomyContext = createContext({ snapshot: null, refresh: async () => {} })

// One snapshot drives the level roadmap, the locker and the crate's drop table,
// and every one of them reads an absent field as "nothing here" rather than
// "not loaded". So a response that arrived without the parts they depend on must
// never replace one that has them: that is what made every level look
// claimable, the locker look like nothing was owned and the drop table lose its
// percentages, all at once. Holding the last good snapshot leaves those screens
// showing something slightly stale instead, which they recover from on the next
// refresh.
const isUsableSnapshot = (value) => Boolean(value)
    && Boolean(value.wallet)
    && Boolean(value.progress)
    && Array.isArray(value.catalog)

const EconomyProvider = ({ userId, progressVersion, children }) => {
    const [snapshot, setSnapshot] = useState(null)
    const [error, setError] = useState('')
    const previousLevelRef = useRef(null)
    const activeUserIdRef = useRef(userId)
    activeUserIdRef.current = userId

    useEffect(() => {

        const level = snapshot?.progress?.level

        if(level == null) return

        const previousLevel = previousLevelRef.current
        previousLevelRef.current = level

        // Only celebrate a level the student actually crossed while watching,
        // never the level they already had when the page loaded.
        if(previousLevel != null && level > previousLevel) {
            levelUpAnimation(false)
        }

    }, [snapshot?.progress?.level])
    const refresherRef = useRef(null)

    const refresh = useCallback(async (options) => {
        if(!userId || activeUserIdRef.current !== userId) return
        if(!refresherRef.current || refresherRef.current.userId !== userId) {
            refresherRef.current?.dispose()
            refresherRef.current = {
                userId,
                ...createSnapshotRefresher({
                    fetchSnapshot: ({ fresh }) => request({ path: '/v1/economy', fresh }),
                    onSnapshot: value => {
                        if(activeUserIdRef.current !== userId) return
                        if(!isUsableSnapshot(value)) {
                            setError('The economy snapshot came back incomplete.')
                            return
                        }
                        setSnapshot(value)
                        setError('')
                    },
                    onError: err => { if(activeUserIdRef.current === userId) setError(err.message) },
                }),
            }
        }
        return refresherRef.current.refresh(options)
    }, [userId])
    useEffect(() => {
        setSnapshot(null)
        setError('')
        previousLevelRef.current = null
        return () => { refresherRef.current?.dispose(); refresherRef.current = null }
    }, [userId])
    const progressRef = useRef({ userId, progressVersion })
    useEffect(() => {
        const previous = progressRef.current
        progressRef.current = { userId, progressVersion }
        refresh({ fresh: previous.userId === userId && previous.progressVersion !== progressVersion })
    }, [refresh, progressVersion, userId])
    const openCrate = async () => {
        const operationId = crypto.randomUUID()
        const result = await post('/v1/economy/crates/open', { operationId })
        await refresh()
        return result
    }
    const tip = async (resourceId, amount) => {
        const result = await post('/v1/economy/tips', { resourceId, amount, operationId: crypto.randomUUID() })
        await refresh()
        return result
    }
    const claimLevel = async (level) => {
        const result = await post('/v1/economy/levels/claim', { level })
        await refresh()
        return result
    }
    const grantTestReward = async ({ xp = 0, lumen = 0 }) => {
        const result = await post('/v1/dev/grant', { xp, lumen })
        await refresh()
        return result
    }
    const resetTestProgress = async () => {
        const result = await post('/v1/dev/reset')
        await refresh()
        return result
    }
    return <EconomyContext.Provider value={{ snapshot, error, refresh, openCrate, tip, claimLevel, grantTestReward, resetTestProgress }}>{children}</EconomyContext.Provider>
}

const useEconomy = () => useContext(EconomyContext)
export { EconomyProvider, useEconomy }
