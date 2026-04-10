import { createContext, useContext, useEffect, useState } from 'react'
import { subscribeToUserStatsByUserId } from '../services/statsService'

const UserStatsContext = createContext({
    userStats: null,
    loading: true,
    error: null,
})

const UserStatsProvider = ({ userId, children }) => {
    
    const [userStats, setUserStats] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        setLoading(true)

        const unsubscribe = subscribeToUserStatsByUserId(userId, setUserStats, setLoading, setError)

        return () => unsubscribe()
    }, [userId])

    return (
        <UserStatsContext.Provider value={{ userStats, loading, error }}>
            {children}
        </UserStatsContext.Provider>
    )

}

const useUserStats = () => useContext(UserStatsContext)

export {
    UserStatsProvider,
    useUserStats
}
