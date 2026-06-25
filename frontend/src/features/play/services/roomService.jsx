import { doc, onSnapshot, orderBy, query, runTransaction, setDoc, collection } from 'firebase/firestore'
import { db } from '../../../lib/firebase'
import { post } from '../../../shared/services/apiService'
import { ROOMS_COLLECTION } from '../utils/multiplayerUtils'

const joinRoom = async ({ roomId, userId, joinedAt = new Date(), joinerName, profilePicture = null, transaction = null }) => {

    if(!roomId || !userId) {
        throw new Error('roomId and userId are required to join a room.')
    }

    const applyJoin = async (activeTransaction) => {

        const roomPlayerRef = doc(db, ROOMS_COLLECTION, roomId, 'players', userId)
        activeTransaction.set(roomPlayerRef, {
            userId,
            displayName: joinerName,
            profilePicture,
            state: {},
        })

    }

    if(transaction) {
        await applyJoin(transaction)
        return
    }

    await runTransaction(db, async (transactionRef) => {
        await applyJoin(transactionRef)
    })

}

const leaveRoom = async ({ roomId, userId, leaverName = null }) => {

    if(!roomId || !userId) {
        throw new Error('roomId and userId are required to leave a room.')
    }

    await post('/multiplayer/room/leave', { roomId, userId, leaverName })

}

const deleteRoom = async ({ roomId, playerIds = [] }) => {

    if(!roomId) {
        throw new Error('roomId is required to delete a room.')
    }

    await post('/multiplayer/room/delete', { roomId, playerIds })

}

const subscribeToRoomById = ( roomId, onChange, setLoading = () => {}, setError = () => {} ) => {

    if(!roomId) {
        onChange?.(null)
        setLoading(false)

        return () => {}
    }

    const roomRef = doc(db, ROOMS_COLLECTION, roomId)
    return onSnapshot(roomRef, (docSnap) => {
        onChange?.(docSnap.exists() ? { uid: docSnap.id, ...docSnap.data() } : null)
        setError(null)
        setLoading(false)
    }, (error) => {
        setError(error)
        setLoading(false)
    })

}

const subscribeToRoomPlayers = ( roomId, onChange, setLoading = () => {}, setError = () => {} ) => {

    if(!roomId) {
        onChange?.([])
        setLoading(false)
        return () => {}
    }

    const playersRef = collection(db, ROOMS_COLLECTION, roomId, 'players')
    return onSnapshot(playersRef, (snapshot) => {
        onChange?.(snapshot.docs.map((docSnap) => ({ uid: docSnap.id, ...docSnap.data() })))
        setError(null)
        setLoading(false)
    }, (error) => {
        setError(error)
        setLoading(false)
    })

}

const subscribeToRoomEvents = ( roomId, onChange, setLoading = () => {}, setError = () => {} ) => {

    if(!roomId) {
        onChange?.([])
        setLoading(false)
        return () => {}
    }

    const eventsRef = collection(db, ROOMS_COLLECTION, roomId, 'events')
    const eventsQuery = query(eventsRef, orderBy('sequence', 'asc'))

    return onSnapshot(eventsQuery, (snapshot) => {
        onChange?.(snapshot.docs.map((docSnap) => ({ uid: docSnap.id, ...docSnap.data() })))
        setError(null)
        setLoading(false)
    }, (error) => {
        setError(error)
        setLoading(false)
    })

}

const setRoomPlayerState = async ({ roomId, userId, state = {} }) => {

    if(!roomId || !userId) {
        throw new Error('roomId and userId are required to set room player state.')
    }

    if(!state || typeof state !== 'object') {
        throw new Error('state must be an object when setting room player state.')
    }

    const roomPlayerRef = doc(db, ROOMS_COLLECTION, roomId, 'players', userId)
    await setDoc(roomPlayerRef, {
        userId,
        ...Object.fromEntries(Object.entries(state).map(([key, value]) => [`state.${key}`, value])),
    }, { merge: true })

}

export {
    joinRoom,
    leaveRoom,
    deleteRoom,
    subscribeToRoomById,
    subscribeToRoomPlayers,
    subscribeToRoomEvents,
    setRoomPlayerState,
}
