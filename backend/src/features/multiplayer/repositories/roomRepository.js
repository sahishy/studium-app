import { db } from '../../../lib/firebaseAdmin.js'

const ROOMS_COLLECTION = 'multiplayerRooms'

const getRoomById = async ({ roomId, transaction = null }) => {

    const roomRef = db.collection(ROOMS_COLLECTION).doc(roomId)
    const roomSnap = transaction
        ? await transaction.get(roomRef)
        : await roomRef.get()

    return roomSnap.exists ? { id: roomSnap.id, ...roomSnap.data() } : null

}

const createRoom = ({ modeId, playerIds, status = 'active', state = {}, createdAt = new Date(), startedAt = createdAt, updatedAt = createdAt, transaction = null }) => {
    
    const roomRef = db.collection(ROOMS_COLLECTION).doc()
    const payload = {
        modeId,
        status,
        playerIds,
        state,
        createdAt,
        startedAt,
        updatedAt,
    }

    if(transaction) {
        transaction.set(roomRef, payload)
        return roomRef.id
    }

    return roomRef.set(payload).then(() => roomRef.id)

}

const createRoomPlayer = ({ roomId, userId, displayName, profilePicture = null, state = {}, transaction = null }) => {

    const playerRef = db.collection(ROOMS_COLLECTION).doc(roomId).collection('players').doc(userId)
    const payload = {
        userId,
        displayName,
        profilePicture,
        state,
    }

    if(transaction) {
        transaction.set(playerRef, payload)
        return
    }

    return playerRef.set(payload)

}

const deleteRoomPlayer = async ({ roomId, userId, transaction = null }) => {

    const playerRef = db.collection(ROOMS_COLLECTION).doc(roomId).collection('players').doc(userId)

    if(transaction) {
        transaction.delete(playerRef)
        return
    }

    await playerRef.delete()

}

const updateRoomPlayerIds = async ({ roomId, playerIds, updatedAt = new Date(), transaction = null }) => {

    const roomRef = db.collection(ROOMS_COLLECTION).doc(roomId)

    if(transaction) {
        transaction.set(roomRef, { playerIds, updatedAt }, { merge: true })
        return
    }

    await roomRef.set({ playerIds, updatedAt }, { merge: true })

}

const updateRoomState = async ({ roomId, state, updatedAt = new Date(), transaction = null }) => {

    const roomRef = db.collection(ROOMS_COLLECTION).doc(roomId)

    if(transaction) {
        transaction.set(roomRef, { state, updatedAt }, { merge: true })
        return
    }

    await roomRef.set({ state, updatedAt }, { merge: true })

}

const deleteRoom = async ({ roomId, transaction = null }) => {

    const roomRef = db.collection(ROOMS_COLLECTION).doc(roomId)

    if(transaction) {
        transaction.delete(roomRef)
        return
    }

    await roomRef.delete()

}

const getRoomPlayersSubcollectionRefs = async ({ roomId }) => {

    const playersSnap = await db.collection(ROOMS_COLLECTION).doc(roomId).collection('players').get()
    return playersSnap.docs.map((docSnap) => docSnap.ref)

}

const deleteRefsBatch = async ({ refs = [] }) => {

    if(!refs.length) {
        return
    }

    const batch = db.batch()
    refs.forEach((docRef) => batch.delete(docRef))
    await batch.commit()
    
}

export {
    getRoomById,
    createRoom,
    createRoomPlayer,
    deleteRoomPlayer,
    updateRoomPlayerIds,
    updateRoomState,
    deleteRoom,
    getRoomPlayersSubcollectionRefs,
    deleteRefsBatch,
}
