import PartySocket from 'partysocket'
import { GameConnection } from './gameConnection'
import { getModeStats } from '../../profile/utils/statsUtils'
import { auth } from '../../../lib/firebase'
import { createServerClock, monotonicNow } from './serverClock'
import { appendById, applyRoomPatch, applyStatePatch } from './gameViewPatch'
import { createRealtimeMetrics, recordActionAck, recordActionSent, recordVisualCorrection, recordAuthoritativeUpdate, recordVisualFrame, recordLocalVisual, summary as summarizeRealtimeMetrics } from './realtimeMetrics'

const host = import.meta.env.VITE_REALTIME_HOST || 'localhost:8787'
// v3: the server sends a generic room/players diff (game.update) instead of per-mode hand-rolled
// delta messages, and coalesces broadcasts instead of sending one per mutation.
const PROTOCOL_VERSION = 4
const CHANNEL_CLOSE_GRACE_MS = 5_000
const CLOCK_REFRESH_MS = 60_000
const RESYNC_TIMEOUT_MS = 2_000
let currentProfile = null
let currentUserStats = null
const gameChannels = new Map()
const admissions = new Map()

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

const createSocket = ({ party, room }) => new PartySocket({ host, party, room, query: async () => ({ ...await buildQuery(), ...(party === 'game' && admissions.has(room) ? { admission: admissions.get(room) } : {}) }), maxRetries: 20 })

const message = (type, payload = {}) => JSON.stringify({
    id: `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    payload,
})

const notifyConnection = (channel) => channel.connectionListeners.forEach((listener) => listener(channel.control.state))

const notify = (channel, full = false) => {
    channel.control.receivedSnapshot(channel.snapshot, full)
    recordAuthoritativeUpdate(channel.metrics, channel.snapshot, auth.currentUser?.uid || currentProfile?.uid, monotonicNow())
    channel.listeners.forEach((listener) => listener(channel.snapshot))
    window.requestAnimationFrame(() => recordVisualFrame(channel.metrics, monotonicNow()))
    if(!channel.control.freshSnapshot) requestResync(channel)
}

// Debounced, never latched. The previous boolean was cleared ONLY on receiving a snapshot, so a
// socket that dropped before the snapshot arrived left it stuck true forever - every later update
// was then silently discarded and the game appeared frozen until the server happened to push an
// unsolicited full snapshot, which snapped everything forward at once.
const requestResync = (channel) => {
    if(channel.socket.readyState !== WebSocket.OPEN) return
    const now = Date.now()
    if(channel.resyncRequestedAt && now - channel.resyncRequestedAt < RESYNC_TIMEOUT_MS) return
    channel.control.beginSync()
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

const finishClockWindow = (channel, samplingId) => {
    if(channel.samplingId !== samplingId || !channel.sampling) return
    channel.sampling = false
    const rttMs = channel.clock.getBestRtt()
    if(rttMs != null && channel.socket.readyState === WebSocket.OPEN) {
        channel.control.receivedClock()
        channel.socket.send(message('system.rttReport', { rttMs: Math.round(rttMs), jitterMs: Math.round(channel.clock.getJitter()) }))
    }
}
const synchronizeClock = (channel) => {
    if(channel.socket.readyState !== WebSocket.OPEN || channel.sampling) return
    channel.lastClockRefresh = Date.now()
    channel.sampling = true
    channel.pongs = 0
    const samplingId = ++channel.samplingId
    channel.clock.beginSamplingWindow()
    ;[0, 100, 250].forEach((delay) => {
        const timer = window.setTimeout(() => {
            channel.clockTimers.delete(timer)
            if(channel.socket.readyState !== WebSocket.OPEN || channel.samplingId !== samplingId) return
            channel.socket.send(message('system.clockPing', { samplingId, clientWallTime: Date.now(), clientMonotonic: monotonicNow() }))
        }, delay)
        channel.clockTimers.add(timer)
    })
    const timer = window.setTimeout(() => {
        channel.clockTimers.delete(timer)
        finishClockWindow(channel, samplingId)
    }, 1_500)
    channel.clockTimers.add(timer)
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
        disconnectListeners: new Set(),
        connectionListeners: new Set(),
        pendingLeaveSince: null,
        errorListeners: new Set(),
        closeTimer: null,
        clock: createServerClock(),
        clockTimers: new Set(),
        clockInterval: null,
        hasOpened: false,
        samplingId: 0, sampling: false, pongs: 0,
        lastClockRefresh: 0,
        lastMetricsReport: Date.now(),
        metrics: createRealtimeMetrics(),
    }
    channel.control = new GameConnection({
        isOpen: () => socket.readyState === WebSocket.OPEN,
        now: () => channel.clock.now(),
        userId: () => auth.currentUser?.uid || currentProfile?.uid,
        transmit: (type, payload) => {
            const wire = message(type, payload), id = JSON.parse(wire).id
            if(['game.answer', 'game.chop', 'game.shoot', 'game.flutterInput'].includes(type)) recordActionSent(channel.metrics, id, type, monotonicNow(), payload)
            socket.send(wire)
            return id
        },
        onReady: () => { notifyConnection(channel); channel.reconnectListeners.forEach((listener) => listener(channel.snapshot)) },
        onReset: () => { notifyConnection(channel); channel.disconnectListeners.forEach((listener) => listener()) },
    })
    socket.addEventListener('message', (event) => {
        try {
            const incoming = JSON.parse(event.data)
            const receivedAt = monotonicNow()
            if(incoming.type === 'system.clockPong') {
                if(!channel.sampling || incoming.payload?.samplingId != null && incoming.payload.samplingId !== channel.samplingId) return
                channel.clock.recordPong(incoming.payload, receivedAt)
                channel.pongs += 1
                if(channel.pongs >= 3) finishClockWindow(channel, channel.samplingId)
                return
            }
            if(incoming.type === 'game.actionResult') {
                recordActionAck(channel.metrics, incoming.id, incoming.payload, receivedAt)
                channel.actionResultListeners.forEach((listener) => listener(incoming.payload ?? {}))
                if(incoming.payload?.accepted === false && ['stale_epoch', 'stale_round', 'stale_sequence', 'invalid_time'].includes(incoming.payload.reason)) {
                    requestResync(channel)
                    synchronizeClock(channel)
                }
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
                notify(channel, true)
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
        channel.control.opened()
        notifyConnection(channel)
        channel.resyncRequestedAt = null
        synchronizeClock(channel)
        if(reconnecting) {
            requestResync(channel)
        }
    })
    socket.addEventListener('close', (event) => {
        channel.control.closed()
        channel.clockTimers.forEach((timer) => clearTimeout(timer))
        channel.clockTimers.clear()
        channel.samplingId += 1
        channel.sampling = false
        // Reset the resync gate so a reconnect can always ask again, and drop the revision base:
        // applying a post-reconnect delta on top of pre-disconnect state would corrupt it silently,
        // which is worse than the freeze this replaces.
        channel.resyncRequestedAt = null
        channel.revision = -1
        if(event.code === 1008) {
            channel.control.pendingLeave = false;
            channel.error = new Error(event.reason || 'This match is no longer available.')
            channel.errorListeners.forEach((listener) => listener(channel.error))
        }
    })
    channel.clockInterval = window.setInterval(() => {
        const active = /^(timber|puncture|flutter)_active$/.test(channel.snapshot?.room?.state?.phase || '')
        const interval = active ? 15_000 : CLOCK_REFRESH_MS
        if(Date.now() - channel.lastClockRefresh >= interval) {
            channel.lastClockRefresh = Date.now()
            synchronizeClock(channel)
        }
        if(socket.readyState === WebSocket.OPEN && Date.now() - channel.lastMetricsReport >= 30_000) {
            channel.lastMetricsReport = Date.now()
            socket.send(message('system.metricsReport', { ...getGameLatencyMetrics(roomId), build: import.meta.env.VITE_BUILD_ID || 'local', protocolVersion: PROTOCOL_VERSION }))
        }
    }, 15_000)
    channel.onVisibility = () => { if(!document.hidden) synchronizeClock(channel) }
    document.addEventListener('visibilitychange', channel.onVisibility)
    gameChannels.set(roomId, channel)
    if(import.meta.env.DEV || new URLSearchParams(window.location.search).has('realtimeDiagnostics')) window.__studiumLatency = () => Object.fromEntries([...gameChannels.keys()].map((id) => [id, getGameLatencyMetrics(id)]))
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

const subscribeToGameConnection = (roomId, listener) => {
    const channel = getGameChannel(roomId)
    channel.connectionListeners.add(listener)
    listener(channel.control.state)
    return () => channel.connectionListeners.delete(listener)
}

const subscribeToGameDisconnect = (roomId, listener) => {
    const channel = getGameChannel(roomId)
    channel.disconnectListeners.add(listener)
    return () => channel.disconnectListeners.delete(listener)
}

const preconnectGame = (roomId, admission = null) => {
    if(!roomId) return
    if(admission) admissions.set(roomId, admission)
    const channel = getGameChannel(roomId)
    if(channel.closeTimer) clearTimeout(channel.closeTimer)
    channel.closeTimer = window.setTimeout(() => {
        channel.closeTimer = null
        if(!channel.listeners.size) closeGameChannel(roomId)
    }, 15_000)
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
    const started = monotonicNow()
    const result = channel.control.send(type, payload)
    if(type === 'game.leave' && !result.sent) channel.pendingLeaveSince ??= Date.now()
    if(['game.chop', 'game.shoot', 'game.flutterInput'].includes(type)) {
        if(result.sent) window.requestAnimationFrame(() => recordLocalVisual(channel.metrics, monotonicNow() - started))
        else channel.metrics.droppedInputs += 1
    }
    if(!result.sent && type === 'chat.send') throw new Error('Chat is reconnecting. Please try again.')
    return result
}

const getGameLatencyMetrics = (roomId) => {
    const channel = gameChannels.get(roomId)
    return channel ? { ...summarizeRealtimeMetrics(channel.metrics), connectionState: channel.control.state, rttMs: channel.clock.getBestRtt(), jitterMs: channel.clock.getJitter() } : null
}
const recordGameVisualCorrection = (roomId, magnitude = 1) => {
    const channel = gameChannels.get(roomId)
    if(channel) recordVisualCorrection(channel.metrics, magnitude)
}

const getGameServerNow = (roomId) => gameChannels.get(roomId)?.clock.now() ?? Date.now()

const closeGameChannel = (roomId) => {
    const channel = gameChannels.get(roomId)
    if(!channel) return
    if(channel.control.pendingLeave && Date.now() - channel.pendingLeaveSince < 35_000) {
        channel.closeTimer = window.setTimeout(() => closeGameChannel(roomId), CHANNEL_CLOSE_GRACE_MS)
        return
    }
    if(channel.closeTimer) clearTimeout(channel.closeTimer)
    if(channel.clockInterval) clearInterval(channel.clockInterval)
    channel.clockTimers.forEach((timer) => clearTimeout(timer))
    document.removeEventListener('visibilitychange', channel.onVisibility)
    channel.socket.close()
    gameChannels.delete(roomId)
    admissions.delete(roomId)
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
    subscribeToGameDisconnect,
    subscribeToGameConnection,
    preconnectGame,
    subscribeToGameSnapshot,
}
