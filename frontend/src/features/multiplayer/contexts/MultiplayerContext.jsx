import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { configureRealtimeProfile, createSocket, message } from '../services/realtimeSocketService'
import { useUserStats } from '../../profile/contexts/UserStatsContext'
import { useToast } from '../../../shared/contexts/ToastContext'
import PartyInviteToast from '../components/toasts/PartyInviteToast'

const MultiplayerContext = createContext(null)
const IDLE_DISCONNECT_MS = 2 * 60_000

const MultiplayerProvider = ({ userId, profile = null, children }) => {
    const [session, setSession] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const socketRef = useRef(null)
    const invitationToastIdsRef = useRef(new Map())
    const { userStats } = useUserStats()
    const { showToast, hideToast } = useToast()

    useEffect(() => {
        configureRealtimeProfile(profile || { uid: userId }, userStats)
    }, [userId, profile, userStats])

    useEffect(() => {
        if(!userId) return () => {}
        let socket = null
        let idleTimer = null

        const onMessage = (event) => {
            try {
                const incoming = JSON.parse(event.data)
                if(incoming.type === 'session.snapshot') {
                    setSession(incoming.payload)
                    setLoading(false)
                    setError(null)
                } else if(incoming.type === 'error') {
                    setError(new Error(incoming.payload?.message || 'Realtime request failed.'))
                }
            } catch {
                setError(new Error('Received an invalid realtime response.'))
            }
        }

        const connect = () => {
            if(socket) return
            socket = createSocket({ party: 'user', room: userId })
            socketRef.current = socket
            socket.addEventListener('message', onMessage)
            socket.addEventListener('close', () => setLoading(false))
        }

        const disconnect = () => {
            if(!socket) return
            socket.close()
            socket = null
            socketRef.current = null
        }

        const clearIdleTimer = () => {
            if(!idleTimer) return
            window.clearTimeout(idleTimer)
            idleTimer = null
        }

        // Backgrounded tabs don't need a live UserServer connection; close it after a grace
        // period to cut idle Durable Object wall-time, and reconnect as soon as the tab is visible again.
        const onVisibilityChange = () => {
            clearIdleTimer()
            if(document.visibilityState === 'hidden') idleTimer = window.setTimeout(disconnect, IDLE_DISCONNECT_MS)
            else connect()
        }

        connect()
        document.addEventListener('visibilitychange', onVisibilityChange)
        window.addEventListener('beforeunload', disconnect)

        return () => {
            clearIdleTimer()
            document.removeEventListener('visibilitychange', onVisibilityChange)
            window.removeEventListener('beforeunload', disconnect)
            disconnect()
        }
    }, [userId])

    const sendCommand = useCallback((type, payload = {}) => {
        const socket = socketRef.current
        if(!socket) throw new Error('Realtime session is not connected.')
        const sendNow = () => socket.send(message(type, payload))
        if(socket.readyState === WebSocket.OPEN) sendNow()
        else socket.addEventListener('open', sendNow, { once: true })
    }, [])

    useEffect(() => {
        const invitations = session?.partyId ? [] : (session?.invitations ?? [])
        const activeKeys = new Set(invitations.map((invitation) => `${invitation.partyId}:${invitation.fromUserId}`))

        invitationToastIdsRef.current.forEach((toastId, key) => {
            if(activeKeys.has(key)) return
            hideToast(toastId, { force: true })
            invitationToastIdsRef.current.delete(key)
        })

        invitations.forEach((invitation) => {
            const key = `${invitation.partyId}:${invitation.fromUserId}`
            if(invitationToastIdsRef.current.has(key)) return

            let toastId = null
            const dismiss = () => {
                sendCommand('party.invite.dismiss', { partyId: invitation.partyId, fromUserId: invitation.fromUserId })
                if(toastId) hideToast(toastId, { force: true })
            }
            toastId = showToast({
                component: PartyInviteToast,
                canHide: false,
                duration: 10000,
                props: {
                    invitation,
                    onIgnore: dismiss,
                    onAccept: () => {
                        sendCommand('party.join', { partyId: invitation.partyId, quietly: true })
                        if(toastId) hideToast(toastId, { force: true })
                    },
                },
            })
            if(toastId) invitationToastIdsRef.current.set(key, toastId)
        })
    }, [session?.partyId, session?.invitations, sendCommand, showToast, hideToast])

    const value = useMemo(() => ({
        session,
        matchmaking: session?.status === 'queue' ? { modeId: session.modeId, queuedAt: new Date(session.queuedAt || Date.now()) } : null,
        loading,
        error,
        joinQueue: async ({ modeId, elo = 0 }) => sendCommand('queue.join', { modeId, elo }),
        leaveQueue: async () => sendCommand('queue.leave'),
        findMatch: async () => ({ matched: false, roomId: null }),
        startSoloGame: async ({ modeId }) => sendCommand('game.startSolo', { modeId }),
        createPartyAndInvite: async ({ userId: targetUserId }) => sendCommand('party.createAndInvite', { userId: targetUserId }),
        joinParty: async ({ partyId }) => sendCommand('party.join', { partyId }),
        leaveParty: async () => sendCommand('party.leave'),
    }), [session, loading, error, sendCommand])

    return <MultiplayerContext.Provider value={value}>{children}</MultiplayerContext.Provider>
}

const useMultiplayer = () => useContext(MultiplayerContext)

export { MultiplayerProvider, useMultiplayer }
