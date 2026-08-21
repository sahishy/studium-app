import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../../../lib/firebase'

const normalizeDisabledRoute = (route) => {
    if(typeof route !== 'string') {
        return null
    }

    const pathname = route.trim()

    if(!pathname || !pathname.startsWith('/') || pathname.startsWith('//') || pathname.includes('?') || pathname.includes('#')) {
        return null
    }

    return pathname.length > 1 && pathname.endsWith('/')
        ? pathname.slice(0, -1)
        : pathname
}

const subscribeToPublicConfig = ( setConfig, setLoading = () => {}, setError = () => {} ) => {

    const publicConfigRef = doc(db, 'config', 'public')

    const unsubscribe = onSnapshot(
        
        publicConfigRef,
        (docSnap) => {
            const data = docSnap.exists() ? (docSnap.data() ?? {}) : {}
            const whitelist = Array.isArray(data?.whitelist)
                ? data.whitelist.filter((item) => typeof item === 'string' && item.trim())
                : []
            const disabledRoutes = Array.isArray(data?.disabled_routes)
                ? data.disabled_routes
                    .map(normalizeDisabledRoute)
                    .filter(Boolean)
                : []

            setConfig({
                maintenance: Boolean(data?.maintenance),
                message: typeof data?.message === 'string' ? data.message : '',
                whitelist,
                disabledRoutes,
            })

            setError(null)
            setLoading(false)
        },
        (error) => {
            setError(error)
            setLoading(false)
        }

    )

    return unsubscribe
    
}

export {
    subscribeToPublicConfig,
}
