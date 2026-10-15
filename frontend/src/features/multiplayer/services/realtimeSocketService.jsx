import PartySocket from 'partysocket'
import { getModeStats } from '../../profile/utils/statsUtils'
import { auth } from '../../../lib/firebase'
import { createServerClock, monotonicNow } from './serverClock'
import { appendById, applyRoomPatch, applyStatePatch } from './gameViewPatch'
import { createRealtimeMetrics, recordActionAck, recordActionSent, recordVisualCorrection, summary as summarizeRealtimeMetrics } from './realtimeMetrics'

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

// The realtime identity, in the shape both the connect query and `identity.update` want. The
// server captures it once per connection, so anything that can change mid-session (avatar,
// display name, elo) has to be pushed again when it does.
const realtimeIdentity = () => ({
    displayName: currentProfile?.profile?.displayName || 'Player',
    profilePicture: currentProfile?.profile?.profilePicture ?? null,
    avatar: currentProfile?.profile?.avatar ?? null,
    title: currentProfile?.profile?.title ?? null,
    level: currentProfile?.progress?.level ?? 1,
    eloByMode: Object.fromEntries(Object.keys(currentUserStats?.play ?? {}).map((modeId) => [modeId, getModeStats(currentUserStats, { id: modeId }).elo ?? 0])),
    // Only read when the worker runs without a backend to verify against, which is the local
    // development setup. In production the verify endpoint supplies the authoritative copy, so a
    // client cannot claim to be unplaced to draw an easier placement opponent.
    placementByMode: Object.fromEntries(Object.entries(currentUserStats?.play ?? {}).map(([modeId, stats]) => [modeId, {
        placed: Boolean(stats?.placed),
        gamesPlayed: Math.max(0, Number(stats?.placementGamesPlayed) || 0),
    }])),
})

const buildQuery = async () => {
    const identity = realtimeIdentity()
    return {
        protocolVersion: PROTOCOL_VERSION,
        userId: auth.currentUser?.uid || currentProfile?.uid || '',
        token: auth.currentUser ? await auth.currentUser.getIdToken() : '',
        displayName: identity.displayName,
        profilePicture: JSON.stringify(identity.profilePicture),
        avatar: JSON.stringify(identity.avatar),
        title: identity.title ?? '',
        level: String(identity.level),
        eloByMode: JSON.stringify(identity.eloByMode),
        placementByMode: JSON.stringify(identity.placementByMode),
    }
}

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
    channel.metrics.resyncs += 1
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
        errorListeners: new Set(),
        closeTimer: null,
        clock: createServerClock(),
        clockTimers: new Set(),
        clockInterval: null,
        hasOpened: false,
        metrics: createRealtimeMetrics(),
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
                recordActionAck(channel.metrics, incoming.id, incoming.payload, receivedAt)
                channel.actionResultListeners.forEach((listener) => listener(incoming.payload ?? {}))
                return
            }
            if(incoming.type === 'game.ack') {
                recordActionAck(channel.metrics, incoming.id, incoming.payload, receivedAt)
                return
            }
            // Observe only - never anchor here. Anchoring off every message with no latency
            // compensation overwrote the RTT-corrected anchor from recordPong milliseconds later,
            // dragging the clock backwards by one-way latency on every single message.
            if(Number.isFinite(Number(incoming.serverNow)) && channel.clock.observeServerTime(Number(incoming.serverNow), receivedAt)) {
                synchronizeClock(channel)
            }
            if(incoming.type === 'game.snapshot') {
                channel.error = null
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
    socket.addEventListener('close', (event) => {
        // Reset the resync gate so a reconnect can always ask again, and drop the revision base:
        // applying a post-reconnect delta on top of pre-disconnect state would corrupt it silently,
        // which is worse than the freeze this replaces.
        channel.resyncRequestedAt = null
        channel.revision = -1
        if(event.code === 1008) {
            channel.error = new Error(event.reason || 'This match is no longer available.')
            channel.errorListeners.forEach((listener) => listener(channel.error))
        }
    })
    channel.clockInterval = window.setInterval(() => synchronizeClock(channel), CLOCK_REFRESH_MS)
    gameChannels.set(roomId, channel)
    if(import.meta.env.DEV) window.__studiumLatency = () => Object.fromEntries([...gameChannels.keys()].map((id) => [id, getGameLatencyMetrics(id)]))
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

const subscribeToGameErrors = (roomId, listener) => {
    const channel = getGameChannel(roomId)
    channel.errorListeners.add(listener)
    if(channel.error) listener(channel.error)
    return () => channel.errorListeners.delete(listener)
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
    const channel = getGameChannel(roomId)
    const socket = channel.socket
    const wire = message(type, payload)
    const id = JSON.parse(wire).id
    const sendNow = () => {
        if(type.startsWith('game.') && !['game.resync', 'game.subscribe', 'game.leave'].includes(type)) recordActionSent(channel.metrics, id, type, monotonicNow())
        socket.send(wire)
    }
    if(socket.readyState === WebSocket.OPEN) sendNow()
    else socket.addEventListener('open', sendNow, { once: true })
}

const getGameLatencyMetrics = (roomId) => {
    const channel = gameChannels.get(roomId)
    return channel ? summarizeRealtimeMetrics(channel.metrics) : null
}
const recordGameVisualCorrection = (roomId, magnitude = 1) => {
    const channel = gameChannels.get(roomId)
    if(channel) recordVisualCorrection(channel.metrics, magnitude)
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
    realtimeIdentity,
    createSocket,
    getGameServerNow,
    getGameLatencyMetrics,
    message,
    recordGameVisualCorrection,
    requestGameResync,
    sendGameMessage,
    subscribeToGameActionResults,
    subscribeToGameErrors,
    subscribeToGameReconnect,
    subscribeToGameSnapshot,
}
