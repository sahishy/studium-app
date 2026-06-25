import { Router } from 'express'
import { getQuestionsController } from '../controllers/questionController.js'

const questionRoutes = Router()

questionRoutes.get('/:count', getQuestionsController)

export default questionRoutes