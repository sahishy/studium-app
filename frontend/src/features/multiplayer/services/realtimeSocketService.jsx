import PartySocket from 'partysocket'
import { auth } from '../../../lib/firebase'

const host = import.meta.env.VITE_REALTIME_HOST || 'localhost:8787'
let currentProfile = null
let currentUserStats = null
const gameChannels = new Map()

const configureRealtimeProfile = (profile, userStats = null) => {
    currentProfile = profile
    currentUserStats = userStats
}

const buildQuery = async () => ({
    userId: auth.currentUser?.uid || currentProfile?.uid || '',
    token: auth.currentUser ? await auth.currentUser.getIdToken() : '',
    displayName: currentProfile?.profile?.displayName || 'Player',
    profilePicture: JSON.stringify(currentProfile?.profile?.profilePicture ?? null),
    avatar: JSON.stringify(currentProfile?.profile?.avatar ?? null),
    eloByMode: JSON.stringify(Object.fromEntries(Object.entries(currentUserStats?.play ?? {}).map(([modeId, stats]) => [modeId, Number(stats?.elo) || 0]))),
})

const createSocket = ({ party, room }) => new PartySocket({
    host,
    party,
    room,
    query: buildQuery,
})

const message = (type, payload = {}) => JSON.stringify({
    id: `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    payload,
})

const getGameChannel = (roomId) => {
    if(gameChannels.has(roomId)) return gameChannels.get(roomId)
    const socket = createSocket({ party: 'game', room: roomId })
    const channel = { socket, snapshot: null, listeners: new Set() }
    socket.addEventListener('message', (event) => {
        try {
            const incoming = JSON.parse(event.data)
            if(incoming.type !== 'game.snapshot') return
            channel.snapshot = incoming.payload
            channel.listeners.forEach((listener) => listener(channel.snapshot))
        } catch {
            // Ignore malformed realtime messages.
        }
    })
    socket.addEventListener('open', () => socket.send(message('game.subscribe')))
    gameChannels.set(roomId, channel)
    return channel
}

const subscribeToGameSnapshot = (roomId, listener) => {
    if(!roomId) return () => {}
    const channel = getGameChannel(roomId)
    channel.listeners.add(listener)
    if(channel.snapshot) listener(channel.snapshot)
    return () => channel.listeners.delete(listener)
}

const sendGameMessage = (roomId, type, payload = {}) => {
    const socket = getGameChannel(roomId).socket
    const sendNow = () => socket.send(message(type, payload))
    if(socket.readyState === WebSocket.OPEN) sendNow()
    else socket.addEventListener('open', sendNow, { once: true })
}

const closeGameChannel = (roomId) => {
    const channel = gameChannels.get(roomId)
    channel?.socket.close()
    gameChannels.delete(roomId)
}

export {
    buildQuery,
    closeGameChannel,
    configureRealtimeProfile,
    createSocket,
    message,
    sendGameMessage,
    subscribeToGameSnapshot,
}
