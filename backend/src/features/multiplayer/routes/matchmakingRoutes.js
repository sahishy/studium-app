import { Router } from 'express'
import { attemptMatchmakeController, joinQueueController, leaveQueueController } from '../controllers/matchmakingController.js'

const matchmakingRoutes = Router()

matchmakingRoutes.post('/queue/join', joinQueueController)
matchmakingRoutes.post('/queue/leave', leaveQueueController)
matchmakingRoutes.post('/attempt', attemptMatchmakeController)

export default matchmakingRoutes
