import { useEffect, useState } from 'react'
import { subscribeToPublicConfig } from '../features/config/services/configService'
import LoadingState from '../shared/components/ui/LoadingState'
import ErrorState from '../shared/components/ui/ErrorState'

const MaintenanceRoute = ({ children }) => {
    
    const [config, setConfig] = useState({ maintenance: false, message: '' })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const unsubscribe = subscribeToPublicConfig(setConfig, setLoading)
        return () => unsubscribe()
    }, [])

    if(loading) {
        return <LoadingState fullPage label='Loading...' />
    }

    if(config?.maintenance) {
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