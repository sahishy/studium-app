import { sendGameMessage } from '../../../services/realtimeSocketService'

const submitSatClassicAnswer = async ({ roomId, submittedResponse = '' }) => {
    const normalizedResponse = String(submittedResponse ?? '').trim()
    if(!roomId || !normalizedResponse) throw new Error('roomId and submittedResponse are required.')
    if(!sendGameMessage(roomId, 'game.answer', { submittedResponse: normalizedResponse }).sent) throw new Error('The match is reconnecting. Please try again.')
}

export { submitSatClassicAnswer }
