import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useToast } from '../../../shared/contexts/ToastContext'
import { useMultiplayer } from '../contexts/MultiplayerContext'
import { MATCH_JOIN_DELAY_SECONDS } from '../utils/multiplayerUtils'
import MatchmakingToast from './toasts/MatchmakingToast'

// Lives with the session so navigation cannot interrupt queue updates or cancellation.
export default function MatchmakingToastController() {
    const { session, leaveQueue, pendingMatch, completeMatchEntry } = useMultiplayer()
    const { showToast, updateToast, hideToast } = useToast()
    const { pathname } = useLocation()
    const navigate = useNavigate()
    const toastIdRef = useRef(null)
    const [countdown, setCountdown] = useState(MATCH_JOIN_DELAY_SECONDS)
    const roomId = pendingMatch?.roomId
    const roomPath = roomId ? `/play/game/${roomId}` : null
    const isJoining = Boolean(roomPath && pathname !== roomPath)
    const deadline = pendingMatch?.deadline
    const isQueueing = session?.status === 'queue'
    const queuedAt = session?.queuedAt

    useEffect(() => {
        if(!roomId) return
        if(pathname === roomPath) {
            completeMatchEntry(roomId)
            return
        }
        const updateCountdown = () => {
            const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
            setCountdown(remaining)
            if(remaining === 0) {
                completeMatchEntry(roomId)
                navigate(roomPath, { replace: true })
            }
        }
        updateCountdown()
        const timer = setInterval(updateCountdown, 250)
        return () => clearInterval(timer)
    }, [roomId, roomPath, pathname, deadline, completeMatchEntry, navigate])

    useEffect(() => {
        if(!isQueueing && !isJoining) {
            if(toastIdRef.current) hideToast(toastIdRef.current, { force: true })
            toastIdRef.current = null
            return
        }
        const props = {
            state: isQueueing ? 'queueing' : 'matched',
            queuedAt,
            matchCountdownSeconds: countdown,
            onLeaveQueue: leaveQueue,
        }
        if(toastIdRef.current) updateToast(toastIdRef.current, { props })
        else toastIdRef.current = showToast({ component: MatchmakingToast, props, duration: null })
    }, [isQueueing, isJoining, queuedAt, countdown, leaveQueue, showToast, updateToast, hideToast])

    useEffect(() => () => {
        if(toastIdRef.current) hideToast(toastIdRef.current, { force: true })
    }, [hideToast])

    return null
}
