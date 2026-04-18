import { Router } from 'express'
import { deleteRoomController, leaveRoomController } from '../controllers/roomController.js'

const roomRoutes = Router()

roomRoutes.post('/leave', leaveRoomController)
roomRoutes.post('/delete', deleteRoomController)

export default roomRoutes
