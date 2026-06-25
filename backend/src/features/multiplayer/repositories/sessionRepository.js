import { db } from '../../../lib/firebaseAdmin.js'

const PLAY_SESSIONS_COLLECTION = 'playSessions'

const setSessionState = async ({ userId, status, modeId = null, currentRoomId = null, updatedAt = new Date(), transaction = null }) => {
    
    const sessionRef = db.collection(PLAY_SESSIONS_COLLECTION).doc(userId)
    const payload = {
        userId,
        status,
        modeId,
        currentRoomId,
        updatedAt,
    }

    if(transaction) {
        transaction.set(sessionRef, payload, { merge: true })
        return
    }

    await sessionRef.set(payload, { merge: true })
    
}

export {
    setSessionState,
}
