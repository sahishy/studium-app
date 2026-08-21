import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { subscribeToPublicConfig } from '../features/config/services/configService'
import { useAuth } from '../features/auth/contexts/AuthContext'
import LoadingState from '../shared/components/ui/LoadingState'
import ErrorState from '../shared/components/ui/ErrorState'

const MaintenanceRoute = ({ children }) => {
    
    const { user } = useAuth()
    const { pathname } = useLocation()
    const [config, setConfig] = useState({ maintenance: false, message: '', whitelist: [], disabledRoutes: [] })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const unsubscribe = subscribeToPublicConfig(setConfig, setLoading)
        return () => unsubscribe()
    }, [])

    const isAlwaysAvailableRoute = pathname === '/' || pathname === '/welcome'

    if(isAlwaysAvailableRoute) {
        return children
    }

    if(loading) {
        return <LoadingState fullPage/>
    }

    const isWhitelisted = Boolean(user?.uid) && (config?.whitelist ?? []).includes(user.uid)
    const disabledRoutes = config?.disabledRoutes ?? []
    const isDisabledRoute = disabledRoutes.length === 0 || disabledRoutes.some((route) => (
        pathname === route || pathname.startsWith(`${route}/`)
    ))

    if(config?.maintenance && !isWhitelisted && isDisabledRoute) {
        return (
            <ErrorState
                fullPage
                title='Studium is undergoing maintenance'
                description={config?.message
                    ? `Sahish: ${config.message}`
                    : 'No message from Sahish. Please check back soon.'
                }
            />
        )
    }

    return children

}

export default MaintenanceRoute
