import { getRandomQuestions } from '../services/questionsService.js'

const getQuestionsController = async (req, res) => {
    try {
        const count = req.params?.count
        const questions = getRandomQuestions({ count })
        res.status(200).json({ questions })
    } catch (error) {
        res.status(400).json({ error: error.message || 'Failed to get questions.' })
    }
}

export {
    getQuestionsController,
}