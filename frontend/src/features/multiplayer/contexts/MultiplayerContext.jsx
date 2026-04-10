import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
    cancelQueue,
    joinQueue,
    subscribeToMatchmakingByUserId,
    subscribeToSessionByUserId,
    tryMatchmake,
} from '../services/multiplayerService'

const MultiplayerContext = createContext({
    matchmaking: null,
    session: null,
    loading: true,
    error: null,
    joinQueue: async () => {},
    leaveQueue: async () => {},
    findMatch: async () => ({ matched: false, roomId: null }),
})

const MultiplayerProvider = ({ userId, children }) => {

    const [matchmaking, setMatchmaking] = useState(null)
    const [session, setSession] = useState(null)
    const [matchmakingLoading, setMatchmakingLoading] = useState(true)
    const [sessionLoading, setSessionLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {

        setMatchmakingLoading(true)
        const unsubscribe = subscribeToMatchmakingByUserId(
            userId,
            setMatchmaking,
            setMatchmakingLoading,
            setError,
        )

        return () => unsubscribe()

    }, [userId])

    useEffect(() => {

        setSessionLoading(true)
        const unsubscribe = subscribeToSessionByUserId(
            userId,
            setSession,
            setSessionLoading,
            setError,
        )

        return () => unsubscribe()

    }, [userId])

    const loading = matchmakingLoading || sessionLoading

    const value = useMemo(() => ({
        matchmaking,
        session,
        loading,
        error,
        joinQueue: async ({ modeId, elo = 0 }) => {
            if(!userId) {
                throw new Error('A valid userId is required to join queue.')
            }

            await joinQueue({ userId, modeId, elo })
        },
        leaveQueue: async () => {
            if(!userId) {
                throw new Error('A valid userId is required to leave queue.')
            }

            await cancelQueue({ userId })
        },
        findMatch: async ({ modeId }) => {
            if(!userId) {
                return { matched: false, roomId: null }
            }

            return tryMatchmake({ userId, modeId })
        },
    }), [matchmaking, session, loading, error, userId])

    return (
        <MultiplayerContext.Provider value={value}>
            {children}
        </MultiplayerContext.Provider>
    )
    
}

const useMultiplayer = () => useContext(MultiplayerContext)

export {
    MultiplayerProvider,
    useMultiplayer,
}
