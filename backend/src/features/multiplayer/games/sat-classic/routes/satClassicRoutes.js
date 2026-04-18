import { Router } from 'express'
import {
    submitSatClassicAnswerController,
} from '../controllers/satClassicController.js'

const satClassicRoutes = Router()

satClassicRoutes.post('/answer/submit', submitSatClassicAnswerController)

export default satClassicRoutes
