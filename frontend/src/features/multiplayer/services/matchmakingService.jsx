import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../../../lib/firebase'
import { post } from '../../../shared/services/apiService'
import { MATCHMAKING_COLLECTION, SESSIONS_COLLECTION } from '../utils/multiplayerUtils'

const joinQueue = async ({ userId, modeId, elo = 0, displayName = 'A player', profilePicture = null }) => {

    if(!userId || !modeId) {
        throw new Error('userId and modeId are required to join queue.')
    }

    await post('/multiplayer/matchmaking/queue/join', {
        userId,
        modeId,
        elo,
        displayName,
        profilePicture,
    })

}

const cancelQueue = async ({ userId }) => {

    if(!userId) {
        throw new Error('userId is required to cancel queue.')
    }

    await post('/multiplayer/matchmaking/queue/leave', { userId })

}

const tryMatchmake = async ({ userId, modeId }) => {

    if(!userId || !modeId) {
        return { matched: false, roomId: null }
    }

    return post('/multiplayer/matchmaking/attempt', { userId, modeId })

}

const subscribeToMatchmakingByUserId = ( userId, onChange, setLoading = () => {}, setError = () => {} ) => {

    if(!userId) {
        onChange?.(null)
        setLoading(false)
        return () => {}
    }

    const matchmakingRef = doc(db, MATCHMAKING_COLLECTION, userId)
    return onSnapshot(matchmakingRef, (docSnap) => {
        onChange?.(docSnap.exists() ? { uid: docSnap.id, ...docSnap.data() } : null)
        setError(null)
        setLoading(false)
    }, (error) => {
        setError(error)
        setLoading(false)
    })

}

const subscribeToSessionByUserId = ( userId, onChange, setLoading = () => {}, setError = () => {} ) => {

    if(!userId) {
        onChange?.(null)
        setLoading(false)
        return () => {}
    }

    const sessionRef = doc(db, SESSIONS_COLLECTION, userId)
    return onSnapshot(sessionRef, (docSnap) => {
        onChange?.(docSnap.exists() ? { uid: docSnap.id, ...docSnap.data() } : null)
        setError(null)
        setLoading(false)
    }, (error) => {
        setError(error)
        setLoading(false)
    })
    
}

export {
    joinQueue,
    cancelQueue,
    tryMatchmake,
    subscribeToMatchmakingByUserId,
    subscribeToSessionByUserId,
}
