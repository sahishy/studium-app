import { post } from '../../../../../shared/services/apiService'

const submitSatClassicAnswer = async ({ roomId, userId, submittedResponse = '', isTimeout = false }) => {

    const normalizedResponse = String(submittedResponse ?? '').trim()
    const timeoutSubmission = Boolean(isTimeout)

    if(!roomId || !userId || (!timeoutSubmission && !normalizedResponse)) {
        throw new Error('roomId, userId, and submittedResponse are required to submit an answer.')
    }

    await post('/multiplayer/games/sat-classic/answer/submit', {
        roomId,
        userId,
        submittedResponse: normalizedResponse,
        isTimeout: timeoutSubmission,
    })

}

export {
    submitSatClassicAnswer
}
