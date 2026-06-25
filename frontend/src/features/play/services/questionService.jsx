import { request } from '../../../shared/services/apiService'

const getQuestions = async ({ count }) => {

    const clampedCount = Math.min(Math.max(1, Number(count) || 1), 20);
    const response = await request({ path: `/multiplayer/questions/${clampedCount}` })

    return response?.questions ?? []
    
}

export {
    getQuestions,
}