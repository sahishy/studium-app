import { db } from '../../../lib/firebaseAdmin.js'

const sendRoomSystemMessage = async ({ roomId, text, transaction = null, createdAt = new Date() }) => {

    if(!roomId || !text?.trim()) {
        throw new Error('roomId and non-empty text are required to send a room system message.')
    }

    const messageRef = db.collection('multiplayerRooms').doc(roomId).collection('chat').doc()
    const payload = {
        userId: null,
        senderName: 'System',
        text: text.trim(),
        createdAt,
    }

    if(transaction) {
        transaction.set(messageRef, payload)
        return
    }

    await messageRef.set(payload)

}

export {
    sendRoomSystemMessage,
}
