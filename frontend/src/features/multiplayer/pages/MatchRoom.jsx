import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import Topbar from '../../../shared/components/ui/Topbar'
import { useMultiplayer } from '../contexts/MultiplayerContext'
import { useToast } from '../../../shared/contexts/ToastContext'
import MatchmakingToast from '../components/toasts/MatchmakingToast'
import ChatBox from '../components/ChatBox'
import { subscribeToRoomById } from '../services/multiplayerService'
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
    const initialToastStackRef = useRef(toastStack)
    const senderName = useMemo(() => (profile?.profile?.displayName), [profile])

    useEffect(() => {
        initialToastStackRef.current.forEach((toastEntry) => {
            if(toastEntry.component === MatchmakingToast) {
                hideToast(toastEntry.id, { force: true })
            }
        })
    }, [hideToast])

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
            navigate('/ranked', { replace: true })
            return
        }

        if(!roomLoading && !room) {
            navigate('/ranked', { replace: true })
        }
    }, [hasRoomId, roomLoading, room, navigate])

    useEffect(() => {
        if(!session) {
            return
        }

        const isCurrentRoom = session.currentRoomId === roomId
        const inRoomState = session.status === 'in_room'

        if(!inRoomState || !isCurrentRoom) {
            navigate('/ranked', { replace: true })
        }
    }, [session, roomId, navigate])

    return (
        <div className='relative flex flex-col h-full overflow-hidden'>
            <Topbar profile={profile} />

            <div className='w-full flex-1 min-h-0 px-24 pb-24 pt-2 flex items-center justify-center'>
                <div className='w-full max-w-5xl h-full min-h-[420px] max-h-[72vh]'>
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
