import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import Topbar from '../../../shared/components/ui/Topbar'
import { useMultiplayer } from '../contexts/MultiplayerContext'
import { useToast } from '../../../shared/contexts/ToastContext'
import MatchmakingToast from '../components/toasts/MatchmakingToast'
import ChatBox from '../components/ChatBox'
import { leaveRoom, subscribeToRoomById } from '../services/roomService'
import GameHandler from '../games/GameHandler'

const MatchRoom = () => {
    
    const { roomId } = useParams()
    const { profile } = useOutletContext()
    const { session } = useMultiplayer()
    const { toastStack, hideToast } = useToast()
    const navigate = useNavigate()

    const [room, setRoom] = useState(null)
    const [roomLoading, setRoomLoading] = useState(true)

    const hasRoomId = useMemo(() => Boolean(roomId), [roomId])
    const senderName = useMemo(() => (profile?.profile?.displayName), [profile])
    const isGameFinished = room?.status === 'finished'
        || room?.state?.phase === 'match_result'
        || room?.state?.phase === 'finished'

    const handleLeaveGame = async () => {
        if(!roomId) return
        await leaveRoom({ roomId })
        navigate('/play')
    }

    const handleReturnHome = async () => {
        try {
            if(roomId && room?.status === 'active') {
                await leaveRoom({ roomId })
            }
        } finally {
            navigate('/play')
        }
    }

    useEffect(() => {
        toastStack.forEach((toastEntry) => {
            if(toastEntry.component === MatchmakingToast) {
                hideToast(toastEntry.id, { force: true })
            }
        })
    }, [toastStack, hideToast])

    useEffect(() => {
        if(!roomId) {
            setRoom(null)
            setRoomLoading(false)
            return () => {}
        }

        setRoomLoading(true)
        const unsubscribe = subscribeToRoomById(roomId, setRoom, setRoomLoading)
        return () => unsubscribe()
    }, [roomId])

    useEffect(() => {
        if(!hasRoomId) {
            navigate('/play', { replace: true })
            return
        }

        if(!roomLoading && !room) {
            navigate('/play', { replace: true })
        }
    }, [hasRoomId, roomLoading, room, navigate])

    useEffect(() => {
        if(!session) {
            return
        }

        if(isGameFinished) return

        const isCurrentRoom = session.currentRoomId === roomId
        const inRoomState = session.status === 'in_room'

        if(!inRoomState || !isCurrentRoom) {
            navigate('/play', { replace: true })
        }
    }, [session, isGameFinished, roomId, navigate])

    return (
        <div className='relative flex flex-col h-full overflow-hidden'>
            <Topbar
                profile={profile}
                showGameAction={Boolean(room)}
                isGameFinished={isGameFinished}
                onLeaveGame={handleLeaveGame}
                onReturnHome={handleReturnHome}
            />

            <div className='w-full flex-1 min-h-0 px-8 xl:px-12 pb-8 pt-2 flex items-center justify-center'>
                <div className='w-full max-w-[88rem] h-full min-h-[420px]'>
                    <GameHandler
                        modeId={room?.modeId || session?.modeId}
                        roomId={roomId}
                        userId={profile?.uid}
                    />
                </div>
            </div>

            <ChatBox
                roomId={roomId}
                userId={profile?.uid}
                senderName={senderName}
            />

        </div>
    )
}

export default MatchRoom
