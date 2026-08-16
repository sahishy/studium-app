import { sendGameMessage } from '../../../services/realtimeSocketService'

const submitSatClassicAnswer = async ({ roomId, submittedResponse = '' }) => {
    const normalizedResponse = String(submittedResponse ?? '').trim()
    if(!roomId || !normalizedResponse) throw new Error('roomId and submittedResponse are required.')
    sendGameMessage(roomId, 'game.answer', { submittedResponse: normalizedResponse })
}

export { submitSatClassicAnswer }
