import PartySocket from 'partysocket'
import { auth } from '../../../lib/firebase'
import { createServerClock, monotonicNow } from './serverClock'

const host = import.meta.env.VITE_REALTIME_HOST || 'localhost:8787'
const PROTOCOL_VERSION = 2
const CHANNEL_CLOSE_GRACE_MS = 5_000
const CLOCK_REFRESH_MS = 60_000
let currentProfile = null
let currentUserStats = null
const gameChannels = new Map()

const configureRealtimeProfile = (profile, userStats = null) => {
    currentProfile = profile
    currentUserStats = userStats
}

const buildQuery = async () => ({
    protocolVersion: PROTOCOL_VERSION,
    userId: auth.currentUser?.uid || currentProfile?.uid || '',
    token: auth.currentUser ? await auth.currentUser.getIdToken() : '',
    displayName: currentProfile?.profile?.displayName || 'Player',
    profilePicture: JSON.stringify(currentProfile?.profile?.profilePicture ?? null),
    avatar: JSON.stringify(currentProfile?.profile?.avatar ?? null),
    eloByMode: JSON.stringify(Object.fromEntries(Object.entries(currentUserStats?.play ?? {}).map(([modeId, stats]) => [modeId, Number(stats?.elo) || 0]))),
})

const createSocket = ({ party, room }) => new PartySocket({ host, party, room, query: buildQuery })

const message = (type, payload = {}) => JSON.stringify({
    id: `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    payload,
})

const notify = (channel) => channel.listeners.forEach((listener) => listener(channel.snapshot))

const requestResync = (channel) => {
    if(channel.resyncPending || channel.socket.readyState !== WebSocket.OPEN) return
    channel.resyncPending = true
    channel.socket.send(message('game.resync'))
}

const appendEvents = (existing = [], incoming = []) => {
    if(!incoming.length) return existing
    const ids = new Set(existing.map((event) => event.uid))
    return [...existing, ...incoming.filter((event) => !ids.has(event.uid))]
}

const applyDelta = (channel, incoming) => {
    const revision = Number(incoming.revision)
    if(!channel.snapshot || !Number.isSafeInteger(revision) || revision !== channel.revision + 1) {
        requestResync(channel)
        return
    }
    const payload = incoming.payload ?? {}
    const playerIndex = channel.snapshot.players?.findIndex((player) => player.userId === payload.userId) ?? -1
    if(playerIndex < 0) return requestResync(channel)
    const players = [...channel.snapshot.players]
    const player = players[playerIndex]
    let statePatch
    if(incoming.type === 'game.flutterState') {
        statePatch = {
            flutterInputSequence: payload.sequence,
            flutterInput: payload.flutterInput,
            flutterX: payload.flutterX,
            flutterY: payload.flutterY,
            flutterVelocityX: payload.flutterVelocityX,
            flutterVelocityY: payload.flutterVelocityY,
            flutterLastUpdatedAt: payload.flutterLastUpdatedAt,
        }
    } else if(incoming.type === 'game.punctureShotResult') {
        statePatch = {
            punctureShotCount: payload.shotCount,
            pinsRemaining: payload.pinsRemaining,
            puncturePinAngles: payload.attachedPinAngles,
            stunnedUntil: payload.stunnedUntil,
            lastShotHit: payload.hit,
            shotImpactAt: payload.shotImpactAt,
            lastClientActionId: payload.clientActionId,
        }
    } else {
        return requestResync(channel)
    }
    players[playerIndex] = { ...player, state: { ...player.state, ...statePatch } }
    channel.snapshot = {
        ...channel.snapshot,
        protocolVersion: PROTOCOL_VERSION,
        revision,
        serverNow: Number(incoming.serverNow) || channel.clock.now(),
        players,
        events: appendEvents(channel.snapshot.events, payload.events),
    }
    channel.revision = revision
    notify(channel)
}

const synchronizeClock = (channel) => {
    if(channel.socket.readyState !== WebSocket.OPEN) return
    channel.clock.beginSamplingWindow()
    ;[0, 100, 250].forEach((delay) => {
        const timer = window.setTimeout(() => {
            channel.clockTimers.delete(timer)
            if(channel.socket.readyState !== WebSocket.OPEN) return
            channel.socket.send(message('system.clockPing', { clientWallTime: Date.now(), clientMonotonic: monotonicNow() }))
        }, delay)
        channel.clockTimers.add(timer)
    })
}

const getGameChannel = (roomId) => {
    if(gameChannels.has(roomId)) return gameChannels.get(roomId)
    const socket = createSocket({ party: 'game', room: roomId })
    const channel = {
        roomId,
        socket,
        snapshot: null,
        revision: -1,
        resyncPending: false,
        listeners: new Set(),
        reconnectListeners: new Set(),
        closeTimer: null,
        clock: createServerClock(),
        clockTimers: new Set(),
        clockInterval: null,
        hasOpened: false,
    }
    socket.addEventListener('message', (event) => {
        try {
            const incoming = JSON.parse(event.data)
            const receivedAt = monotonicNow()
            if(incoming.type === 'system.clockPong') {
                channel.clock.recordPong(incoming.payload, receivedAt)
                return
            }
            if(Number.isFinite(Number(incoming.serverNow))) channel.clock.recordServerTime(Number(incoming.serverNow), receivedAt)
            if(incoming.type === 'game.snapshot') {
                channel.snapshot = incoming.payload
                channel.revision = Number(incoming.payload?.revision ?? incoming.revision) || 0
                channel.resyncPending = false
                notify(channel)
                return
            }
            if(incoming.type === 'game.flutterState' || incoming.type === 'game.punctureShotResult') applyDelta(channel, incoming)
        } catch {
            requestResync(channel)
        }
    })
    socket.addEventListener('open', () => {
        const reconnecting = channel.hasOpened
        channel.hasOpened = true
        synchronizeClock(channel)
        if(reconnecting) {
            requestResync(channel)
            channel.reconnectListeners.forEach((listener) => listener())
        }
    })
    channel.clockInterval = window.setInterval(() => synchronizeClock(channel), CLOCK_REFRESH_MS)
    gameChannels.set(roomId, channel)
    return channel
}

const subscribeToGameSnapshot = (roomId, listener) => {
    if(!roomId) return () => {}
    const channel = getGameChannel(roomId)
    if(channel.closeTimer) {
        clearTimeout(channel.closeTimer)
        channel.closeTimer = null
    }
    channel.listeners.add(listener)
    if(channel.snapshot) listener(channel.snapshot)
    return () => {
        channel.listeners.delete(listener)
        if(channel.listeners.size || channel.closeTimer) return
        channel.closeTimer = window.setTimeout(() => closeGameChannel(roomId), CHANNEL_CLOSE_GRACE_MS)
    }
}

const subscribeToGameReconnect = (roomId, listener) => {
    const channel = getGameChannel(roomId)
    channel.reconnectListeners.add(listener)
    return () => channel.reconnectListeners.delete(listener)
}

const sendGameMessage = (roomId, type, payload = {}) => {
    const socket = getGameChannel(roomId).socket
    const sendNow = () => socket.send(message(type, payload))
    if(socket.readyState === WebSocket.OPEN) sendNow()
    else socket.addEventListener('open', sendNow, { once: true })
}

const getGameServerNow = (roomId) => gameChannels.get(roomId)?.clock.now() ?? Date.now()

const closeGameChannel = (roomId) => {
    const channel = gameChannels.get(roomId)
    if(!channel) return
    if(channel.closeTimer) clearTimeout(channel.closeTimer)
    if(channel.clockInterval) clearInterval(channel.clockInterval)
    channel.clockTimers.forEach((timer) => clearTimeout(timer))
    channel.socket.close()
    gameChannels.delete(roomId)
}

export {
    buildQuery,
    closeGameChannel,
    configureRealtimeProfile,
    createSocket,
    getGameServerNow,
    message,
    sendGameMessage,
    subscribeToGameReconnect,
    subscribeToGameSnapshot,
}
