import {
    submitSatClassicAnswer,
} from '../services/satClassicService.js'

const submitSatClassicAnswerController = async (req, res) => {
    try {
        const result = await submitSatClassicAnswer(req.body ?? {})
        res.status(200).json(result)
    } catch (error) {
        res.status(400).json({ error: error.message || 'Failed to submit sat-classic answer.' })
    }
}

export {
    submitSatClassicAnswerController,
}
