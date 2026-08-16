import { cleanText } from '../../../shared/services/censorService'
import { sendGameMessage, subscribeToGameSnapshot } from './realtimeSocketService'

const subscribeToRoomChat = (roomId, onChange, setLoading = () => {}) => {
    setLoading(true)
    return subscribeToGameSnapshot(roomId, (snapshot) => {
        onChange(snapshot?.chat ?? [])
        setLoading(false)
    })
}

const sendRoomChatMessage = async ({ roomId, text, clientMessageId }) => {
    sendGameMessage(roomId, 'chat.send', { text: cleanText(text), clientMessageId })
}

export { subscribeToRoomChat, sendRoomChatMessage }
