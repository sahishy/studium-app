import { db } from '../../../lib/firebaseAdmin.js'

const MATCHMAKING_COLLECTION = 'multiplayerMatchmaking'

const createQueueEntry = async ({ userId, modeId, elo = 0, displayName = 'A player', profilePicture = null, queuedAt = new Date() }) => {
   
    await db.collection(MATCHMAKING_COLLECTION).doc(userId).create({
        userId,
        modeId,
        elo: Number(elo) || 0,
        displayName: displayName?.trim() || 'A player',
        profilePicture,
        queuedAt,
    })

}

const deleteQueueEntry = async ({ userId, transaction = null }) => {

    const queueRef = db.collection(MATCHMAKING_COLLECTION).doc(userId)

    if(transaction) {
        transaction.delete(queueRef)
        return
    }

    await queueRef.delete()

}

const getQueueEntryByUserId = async ({ userId, transaction = null }) => {

    const queueRef = db.collection(MATCHMAKING_COLLECTION).doc(userId)
    const queueSnap = transaction
        ? await transaction.get(queueRef)
        : await queueRef.get()

    return queueSnap.exists ? { id: queueSnap.id, ...queueSnap.data() } : null

}

const getQueueCandidatesByMode = async ({ modeId, limit = 20 }) => {

    const queueSnap = await db
        .collection(MATCHMAKING_COLLECTION)
        .where('modeId', '==', modeId)
        .orderBy('queuedAt', 'asc')
        .limit(limit)
        .get()

    return queueSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))

}

export {
    createQueueEntry,
    deleteQueueEntry,
    getQueueEntryByUserId,
    getQueueCandidatesByMode,
}
