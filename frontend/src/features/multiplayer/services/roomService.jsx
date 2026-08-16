import { sendGameMessage, subscribeToGameSnapshot } from './realtimeSocketService'

const select = (roomId, selector, onChange, setLoading = () => {}) => {
    setLoading(true)
    return subscribeToGameSnapshot(roomId, (snapshot) => {
        onChange(selector(snapshot))
        setLoading(false)
    })
}

const subscribeToRoomById = (roomId, onChange, setLoading) => select(roomId, (snapshot) => snapshot?.room ?? null, onChange, setLoading)
const subscribeToRoomPlayers = (roomId, onChange, setLoading) => select(roomId, (snapshot) => snapshot?.players ?? [], onChange, setLoading)
const subscribeToRoomEvents = (roomId, onChange, setLoading) => select(roomId, (snapshot) => snapshot?.events ?? [], onChange, setLoading)
const leaveRoom = async ({ roomId }) => sendGameMessage(roomId, 'game.leave')
const deleteRoom = async () => {}
const joinRoom = async () => {}
const setRoomPlayerState = async () => {}

export { joinRoom, leaveRoom, deleteRoom, subscribeToRoomById, subscribeToRoomPlayers, subscribeToRoomEvents, setRoomPlayerState }
