import { collection, doc, onSnapshot, orderBy, query, setDoc } from 'firebase/firestore'
import { db } from '../../../lib/firebase'
import { ROOMS_COLLECTION } from '../utils/multiplayerUtils'
import { cleanText } from '../../../shared/services/censorService'

const subscribeToRoomChat = (roomId, onChange, setLoading = () => { }, setError = () => { }) => {

    if (!roomId) {
        onChange?.([])
        setLoading(false)
        return () => { }
    }

    const chatRef = collection(db, ROOMS_COLLECTION, roomId, 'chat')
    const chatQuery = query(chatRef, orderBy('createdAt', 'asc'))

    return onSnapshot(chatQuery, (snapshot) => {
        onChange?.(snapshot.docs.map((docSnap) => ({ uid: docSnap.id, ...docSnap.data() })))
        setError(null)
        setLoading(false)
    }, (error) => {
        setError(error)
        setLoading(false)
    })

}

const sendRoomChatMessage = async ({ roomId, userId, text, senderName = null, clientMessageId = null }) => {

    if (!roomId || !text?.trim()) {
        throw new Error('roomId and non-empty text are required to send a chat message.')
    }

    if (!userId) {
        throw new Error('userId is required for chat messages.')
    }

    const messageRef = doc(collection(db, ROOMS_COLLECTION, roomId, 'chat'))

    await setDoc(messageRef, {
        userId,
        senderName,
        text: cleanText(text),
        clientMessageId,
        createdAt: new Date(),
    })

}

export {
    subscribeToRoomChat,
    sendRoomChatMessage,
}
