import { toDateFromFirestoreLike } from '../../../shared/utils/formatters'

const MAX_USER_TASKS = 50

const calculateTaskCompletionXp = (taskCreatedAt, taskCompletedAt = new Date()) => {

    const createdDate = toDateFromFirestoreLike(taskCreatedAt)
    const completedDate = toDateFromFirestoreLike(taskCompletedAt)
    if(!createdDate || !completedDate) {
        return 0
    }

    const minutesOld = (completedDate - createdDate) / 1000 / 60
    if(minutesOld < 10) {
        return 0
    }

    const ageMultiplier = Math.min(1.5, 1 + minutesOld / 300)
    const baseXp = 15 + Math.random() * 5

    return Math.min(30, Math.round(baseXp * ageMultiplier))

}

export {
    MAX_USER_TASKS,
    calculateTaskCompletionXp,
}
