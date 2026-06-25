import { doc, setDoc } from 'firebase/firestore'
import { db } from '../../../lib/firebase'
import { PLAY_SESSIONS_COLLECTION } from '../utils/multiplayerUtils'

const setPlaySessionState = async ({ userId, status, modeId = null, currentRoomId = null }) => {
    if(!userId) {
        throw new Error('A valid userId is required to update play session state.')
    }

    await setDoc(doc(db, PLAY_SESSIONS_COLLECTION, userId), {
        userId,
        status,
        modeId,
        currentRoomId,
        updatedAt: new Date(),
    }, { merge: true })
}

export {
    setPlaySessionState,
}