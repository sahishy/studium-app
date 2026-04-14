import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../../../lib/firebase'

const subscribeToPublicConfig = ( setConfig, setLoading = () => {}, setError = () => {} ) => {

    const publicConfigRef = doc(db, 'config', 'public')

    const unsubscribe = onSnapshot(
        
        publicConfigRef,
        (docSnap) => {
            const data = docSnap.exists() ? (docSnap.data() ?? {}) : {}
            const whitelist = Array.isArray(data?.whitelist)
                ? data.whitelist.filter((item) => typeof item === 'string' && item.trim())
                : []

            setConfig({
                maintenance: Boolean(data?.maintenance),
                message: typeof data?.message === 'string' ? data.message : '',
                whitelist,
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