import {
    attemptMatchmake,
    joinQueue,
    leaveQueue,
} from '../services/matchmakingService.js'

const joinQueueController = async (req, res) => {
    try {
        const result = await joinQueue(req.body ?? {})
        res.status(200).json(result)
    } catch (error) {
        res.status(400).json({ error: error.message || 'Failed to join queue.' })
    }
}

const leaveQueueController = async (req, res) => {
    try {
        const result = await leaveQueue(req.body ?? {})
        res.status(200).json(result)
    } catch (error) {
        res.status(400).json({ error: error.message || 'Failed to leave queue.' })
    }
}

const attemptMatchmakeController = async (req, res) => {
    try {
        const result = await attemptMatchmake(req.body ?? {})
        res.status(200).json(result)
    } catch (error) {
        res.status(400).json({ error: error.message || 'Failed to attempt matchmaking.' })
    }
}

export {
    joinQueueController,
    leaveQueueController,
    attemptMatchmakeController,
}
