import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import Topbar from '../../../shared/components/ui/Topbar'
import Card from '../../../shared/components/ui/Card'
import { useMultiplayer } from '../contexts/MultiplayerContext'
import { useToast } from '../../../shared/contexts/ToastContext'
import MatchmakingToast from '../components/toasts/MatchmakingToast'
import ChatBox from '../components/ChatBox'
import { subscribeToRoomById } from '../services/multiplayerService'

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
                <Card className='w-full max-w-xl p-8! gap-4'>
                    <h1 className='text-2xl font-semibold'>Match Room</h1>
                    <p className='text-sm text-text2'>
                        {hasRoomId ? `Room ID: ${roomId}` : 'Missing room id.'}
                    </p>
                    {room?.status ? (
                        <p className='text-sm text-text2'>Room status: {room.status}</p>
                    ) : null}

                </Card>
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
