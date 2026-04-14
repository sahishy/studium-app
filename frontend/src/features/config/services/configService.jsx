import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../../../lib/firebase'

const subscribeToPublicConfig = ( setConfig, setLoading = () => {}, setError = () => {} ) => {

    const publicConfigRef = doc(db, 'config', 'public')

    const unsubscribe = onSnapshot(
        publicConfigRef,
        (docSnap) => {
            const data = docSnap.exists() ? (docSnap.data() ?? {}) : {}

            setConfig({
                maintenance: Boolean(data?.maintenance),
                message: typeof data?.message === 'string' ? data.message : '',
            })

            setError(null)
            setLoading(false)
        },
        (error) => {
            setError(error)
            setLoading(false)
        },
    )

    return unsubscribe
    
}

export {
    subscribeToPublicConfig,
}