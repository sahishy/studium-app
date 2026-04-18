import { post } from '../../../../../shared/services/apiService'

const submitSatClassicAnswer = async ({ roomId, userId, selectedChoiceId }) => {

    if(!roomId || !userId || !selectedChoiceId) {
        throw new Error('roomId, userId, and selectedChoiceId are required to submit an answer.')
    }

    await post('/multiplayer/games/sat-classic/answer/submit', {
        roomId,
        userId,
        selectedChoiceId,
    })

}

export {
    submitSatClassicAnswer
}
