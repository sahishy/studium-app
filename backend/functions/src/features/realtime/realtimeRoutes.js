import { Router } from 'express'
import { getRealtimeQuestions, saveRealtimeResult, verifyRealtimeUser } from './realtimeService.js'
import { saveActivityUpdates } from './activityService.js'

const realtimeRoutes = Router()

realtimeRoutes.post('/auth/verify', async (req, res) => {
    try {
        const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
        res.json(await verifyRealtimeUser(token))
    } catch(error) {
        res.status(401).json({ error: error.message || 'Unauthorized.' })
    }
})

realtimeRoutes.post('/activity', async (req, res) => {
    const expectedSecret = process.env.REALTIME_ACTIVITY_SECRET
    const suppliedSecret = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
    if(!expectedSecret || suppliedSecret !== expectedSecret) {
        res.status(401).json({ error: 'Unauthorized.' })
        return
    }
    try {
        res.json(await saveActivityUpdates(req.body ?? {}))
    } catch(error) {
        res.status(400).json({ error: error.message || 'Unable to update activity.' })
    }
})

realtimeRoutes.post('/questions', (req, res) => {
    try {
        res.json(getRealtimeQuestions(req.body ?? {}))
    } catch(error) {
        res.status(400).json({ error: error.message || 'Unable to load questions.' })
    }
})

realtimeRoutes.post('/results', async (req, res) => {
    try {
        res.json(await saveRealtimeResult(req.body ?? {}))
    } catch(error) {
        res.status(400).json({ error: error.message || 'Unable to save result.' })
    }
})

export default realtimeRoutes
