import { Router } from 'express'
import matchmakingRoutes from './matchmakingRoutes.js'
import roomRoutes from './roomRoutes.js'
import satClassicRoutes from '../games/sat-classic/routes/satClassicRoutes.js'

const multiplayerRoutes = Router()

multiplayerRoutes.use('/matchmaking', matchmakingRoutes)
multiplayerRoutes.use('/room', roomRoutes)
multiplayerRoutes.use('/games/sat-classic', satClassicRoutes)

export default multiplayerRoutes
