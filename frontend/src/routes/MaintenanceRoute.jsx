import { useEffect, useState } from 'react'
import { subscribeToPublicConfig } from '../features/config/services/configService'
import { useAuth } from '../features/auth/contexts/AuthContext'
import LoadingState from '../shared/components/ui/LoadingState'
import ErrorState from '../shared/components/ui/ErrorState'

const MaintenanceRoute = ({ children }) => {
    
    const { user } = useAuth()
    const [config, setConfig] = useState({ maintenance: false, message: '', whitelist: [] })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const unsubscribe = subscribeToPublicConfig(setConfig, setLoading)
        return () => unsubscribe()
    }, [])

    if(loading) {
        return <LoadingState fullPage label='Loading...' />
    }

    const isWhitelisted = Boolean(user?.uid) && (config?.whitelist ?? []).includes(user.uid)

    if(config?.maintenance && !isWhitelisted) {
        return (
            <ErrorState
                fullPage
                title='Studium is undergoing maintenance'
                description={`Sahish: ${config?.message}` || 'No message from Sahish. Please check back soon.'}
            />
        )
    }

    return children

}

export default MaintenanceRoute