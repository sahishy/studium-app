import { deleteRoomById, leaveRoom } from '../services/roomService.js'

const leaveRoomController = async (req, res) => {
    try {
        const result = await leaveRoom(req.body ?? {})
        res.status(200).json(result)
    } catch (error) {
        res.status(400).json({ error: error.message || 'Failed to leave room.' })
    }
}

const deleteRoomController = async (req, res) => {
    try {
        const result = await deleteRoomById(req.body ?? {})
        res.status(200).json(result)
    } catch (error) {
        res.status(400).json({ error: error.message || 'Failed to delete room.' })
    }
}

export {
    leaveRoomController,
    deleteRoomController,
}
