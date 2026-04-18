import { db } from '../../../lib/firebaseAdmin.js'

const SESSIONS_COLLECTION = 'multiplayerSessions'

const setSessionState = async ({ userId, status, modeId = null, currentRoomId = null, updatedAt = new Date(), transaction = null }) => {
    
    const sessionRef = db.collection(SESSIONS_COLLECTION).doc(userId)
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
