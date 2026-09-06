import PartySocket from 'partysocket'
import { auth } from '../../../lib/firebase'
import { createServerClock, monotonicNow } from './serverClock'
import { appendById, applyRoomPatch, applyStatePatch } from './gameViewPatch'

const host = import.meta.env.VITE_REALTIME_HOST || 'localhost:8787'
// v3: the server sends a generic room/players diff (game.update) instead of per-mode hand-rolled
// delta messages, and coalesces broadcasts instead of sending one per mutation.
const PROTOCOL_VERSION = 3
const CHANNEL_CLOSE_GRACE_MS = 5_000
const CLOCK_REFRESH_MS = 60_000
const RESYNC_TIMEOUT_MS = 2_000
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

const createSocket = ({ party, room }) => new PartySocket({ host, party, room, query: buildQuery, maxRetries: 20 })

const message = (type, payload = {}) => JSON.stringify({
    id: `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    payload,
})

const notify = (channel) => channel.listeners.forEach((listener) => listener(channel.snapshot))

// Debounced, never latched. The previous boolean was cleared ONLY on receiving a snapshot, so a
// socket that dropped before the snapshot arrived left it stuck true forever - every later update
// was then silently discarded and the game appeared frozen until the server happened to push an
// unsolicited full snapshot, which snapped everything forward at once.
const requestResync = (channel) => {
    if(channel.socket.readyState !== WebSocket.OPEN) return
    const now = Date.now()
    if(channel.resyncRequestedAt && now - channel.resyncRequestedAt < RESYNC_TIMEOUT_MS) return
    channel.resyncRequestedAt = now
    channel.socket.send(message('game.resync'))
}

// Generic diff application (protocolVersion >= 3, see servers/game-view.ts). Every mode gets a
// compact update through this single path now - no more per-mode message types.
const applyUpdate = (channel, incoming) => {
    const revision = Number(incoming.revision)
    if(!channel.snapshot || !Number.isSafeInteger(revision) || revision !== channel.revision + 1) {
        requestResync(channel)
        return
    }
    const payload = incoming.payload ?? {}
    const players = (channel.snapshot.players ?? []).map((player) => (
        payload.players?.[player.userId] ? { ...player, state: applyStatePatch(player.state, payload.players[player.userId]) } : player
    ))
    channel.snapshot = {
        ...channel.snapshot,
        protocolVersion: PROTOCOL_VERSION,
        revision,
        serverNow: Number(incoming.serverNow) || channel.clock.now(),
        room: applyRoomPatch(channel.snapshot.room, payload.room),
        players,
        events: appendById(channel.snapshot.events, payload.events),
        chat: appendById(channel.snapshot.chat, payload.chat),
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
    const rttTimer = window.setTimeout(() => {
        channel.clockTimers.delete(rttTimer)
        if(channel.socket.readyState !== WebSocket.OPEN) return
        const rttMs = channel.clock.getBestRtt()
        if(rttMs != null) channel.socket.send(message('system.rttReport', { rttMs: Math.round(rttMs) }))
    }, 600)
    channel.clockTimers.add(rttTimer)
}

const getGameChannel = (roomId) => {
    if(gameChannels.has(roomId)) return gameChannels.get(roomId)
    const socket = createSocket({ party: 'game', room: roomId })
    const channel = {
        roomId,
        socket,
        snapshot: null,
        revision: -1,
        resyncRequestedAt: null,
        listeners: new Set(),
        actionResultListeners: new Set(),
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
            if(incoming.type === 'game.actionResult') {
                channel.actionResultListeners.forEach((listener) => listener(incoming.payload ?? {}))
                return
            }
            // Observe only - never anchor here. Anchoring off every message with no latency
            // compensation overwrote the RTT-corrected anchor from recordPong milliseconds later,
            // dragging the clock backwards by one-way latency on every single message.
            if(Number.isFinite(Number(incoming.serverNow)) && channel.clock.observeServerTime(Number(incoming.serverNow), receivedAt)) {
                synchronizeClock(channel)
            }
            if(incoming.type === 'game.snapshot') {
                channel.snapshot = incoming.payload
                channel.revision = Number(incoming.payload?.revision ?? incoming.revision) || 0
                channel.resyncRequestedAt = null
                notify(channel)
                return
            }
            if(incoming.type === 'game.update') applyUpdate(channel, incoming)
        } catch {
            requestResync(channel)
        }
    })
    socket.addEventListener('open', () => {
        const reconnecting = channel.hasOpened
        channel.hasOpened = true
        channel.resyncRequestedAt = null
        synchronizeClock(channel)
        if(reconnecting) {
            requestResync(channel)
            channel.reconnectListeners.forEach((listener) => listener())
        }
    })
    socket.addEventListener('close', () => {
        // Reset the resync gate so a reconnect can always ask again, and drop the revision base:
        // applying a post-reconnect delta on top of pre-disconnect state would corrupt it silently,
        // which is worse than the freeze this replaces.
        channel.resyncRequestedAt = null
        channel.revision = -1
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

const subscribeToGameActionResults = (roomId, listener) => {
    const channel = getGameChannel(roomId)
    channel.actionResultListeners.add(listener)
    return () => channel.actionResultListeners.delete(listener)
}

const requestGameResync = (roomId) => {
    const channel = gameChannels.get(roomId)
    if(channel) requestResync(channel)
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
    applyUpdate,
    buildQuery,
    closeGameChannel,
    configureRealtimeProfile,
    createSocket,
    getGameServerNow,
    message,
    requestGameResync,
    sendGameMessage,
    subscribeToGameActionResults,
    subscribeToGameReconnect,
    subscribeToGameSnapshot,
}
