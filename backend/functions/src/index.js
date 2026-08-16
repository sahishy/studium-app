import express from 'express'
import cors from 'cors'
import { onRequest } from 'firebase-functions/v2/https'
import realtimeRoutes from './features/realtime/realtimeRoutes.js'

// const USE_FIREBASE_EMULATORS = process.env.USE_FIREBASE_EMULATORS === 'true'

const app = express()

app.use(cors({ origin: true }))
app.use(express.json())

app.use('/realtime', realtimeRoutes)

app.get('/test', (req, res) => {
	res.send('Express route works')
})

export const api = onRequest({ cors: true }, app)
