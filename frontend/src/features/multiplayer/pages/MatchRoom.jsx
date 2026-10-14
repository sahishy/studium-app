import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router-dom'
import Topbar from '../../../shared/components/ui/Topbar'
import { useMultiplayer } from '../contexts/MultiplayerContext'
import { useToast } from '../../../shared/contexts/ToastContext'
import MatchmakingToast from '../components/toasts/MatchmakingToast'
import ChatBox from '../components/ChatBox'
import { leaveRoom, subscribeToRoomById, subscribeToRoomPlayers } from '../services/roomService'
import GameHandler from '../games/GameHandler'
import MatchIntroOverlay from '../components/MatchIntroOverlay'
import MatchRewardWatcher from '../components/MatchRewardWatcher'
import { subscribeToGameErrors } from '../services/realtimeSocketService'
import ErrorState from '../../../shared/components/ui/ErrorState'
import LoadingState from '../../../shared/components/ui/LoadingState'

const MatchRoom = () => {
    
    const { roomId } = useParams()
    const [searchParams] = useSearchParams()
    const { profile } = useOutletContext()
    const { session } = useMultiplayer()
    const { toastStack, hideToast } = useToast()
    const navigate = useNavigate()

    const [room, setRoom] = useState(null)
    const [roomLoading, setRoomLoading] = useState(true)
    const [players, setPlayers] = useState([])
    const [roomError, setRoomError] = useState(null)

    const hasRoomId = useMemo(() => Boolean(roomId), [roomId])
    const spectatedUserId = searchParams.get('spectate')
    const isOwnCurrentRoom = session?.status === 'in_room' && session.currentRoomId === roomId
    const isSpectating = Boolean(spectatedUserId && spectatedUserId !== profile?.uid && !isOwnCurrentRoom)
    const spectatedPlayer = players.find((player) => player.userId === spectatedUserId) ?? null
    const senderName = useMemo(() => (profile?.profile?.displayName), [profile])
    const isGameFinished = room?.status === 'finished'
        || room?.state?.phase === 'match_result'
        || room?.state?.phase === 'finished'

    const handleLeaveGame = async () => {
        if(isSpectating) return handleStopSpectating()
        if(!roomId) return
        await leaveRoom({ roomId })
        navigate('/play')
    }

    const handleStopSpectating = () => {
        if(spectatedPlayer?.displayName) {
            navigate(`/profile/${encodeURIComponent(spectatedPlayer.displayName)}`)
            return
        }
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
        setRoomError(null)
        const unsubscribe = subscribeToRoomById(roomId, setRoom, setRoomLoading)
        const unsubscribePlayers = subscribeToRoomPlayers(roomId, setPlayers)
        const unsubscribeErrors = subscribeToGameErrors(roomId, setRoomError)
        return () => {
            unsubscribe()
            unsubscribePlayers()
            unsubscribeErrors()
        }
    }, [roomId])

    useEffect(() => {
        if(!hasRoomId) {
            navigate('/play', { replace: true })
            return
        }

        if(!isSpectating && !roomLoading && !room) {
            navigate('/play', { replace: true })
        }
    }, [hasRoomId, isSpectating, roomLoading, room, navigate])

    useEffect(() => {
        if(!session) {
            return
        }

        if(isSpectating) {
            if(session.status === 'in_room' && session.currentRoomId) {
                navigate(`/play/game/${session.currentRoomId}`, { replace: true })
            }
            return
        }

        if(isGameFinished) return

        const isCurrentRoom = session.currentRoomId === roomId
        const inRoomState = session.status === 'in_room'

        if(!inRoomState || !isCurrentRoom) {
            navigate('/play', { replace: true })
        }
    }, [session, isGameFinished, isSpectating, roomId, navigate])

    useEffect(() => {
        if(isSpectating && !roomLoading && room && players.length && !spectatedPlayer) {
            setRoomError(new Error('The selected player is not in this match.'))
        }
    }, [isSpectating, players, room, roomLoading, spectatedPlayer])

    return (
        <div className='relative flex flex-col h-full overflow-hidden'>
            {!isSpectating ? (
                <MatchRewardWatcher roomId={roomId} userId={profile?.uid} />
            ) : null}


            <Topbar
                profile={profile}
                showGameAction={Boolean(room) || isSpectating}
                isGameFinished={isGameFinished}
                onLeaveGame={handleLeaveGame}
                onReturnHome={isSpectating ? handleStopSpectating : handleReturnHome}
                gameActionLabel={isSpectating ? (isGameFinished ? 'Return to profile' : 'Stop spectating') : null}
                gameActionType={isSpectating ? 'secondary' : null}
            />

            <div className='w-full flex-1 min-h-0 px-8 xl:px-12 pb-8 pt-2 flex items-center justify-center'>
                <div className='relative w-full max-w-[88rem] h-full min-h-[420px] flex flex-col gap-2'>
                    {isSpectating && spectatedPlayer ? (
                        <p className='text-center text-sm font-semibold text-neutral1'>Spectating {spectatedPlayer.displayName}</p>
                    ) : null}
                    {roomError ? (
                        <ErrorState title='Unable to spectate' description={roomError.message} />
                    ) : roomLoading ? (
                        <LoadingState className='min-h-[420px]' />
                    ) : (
                        <GameHandler
                            modeId={room?.modeId || session?.modeId}
                            roomId={roomId}
                            userId={isSpectating ? spectatedUserId : profile?.uid}
                            readOnly={isSpectating}
                            spectatorName={spectatedPlayer?.displayName ?? null}
                            matchIntro={!isSpectating && room?.state?.introEndsAt ? (
                                <MatchIntroOverlay
                                    roomId={roomId}
                                    players={players}
                                    userId={profile?.uid}
                                    modeId={room?.modeId || session?.modeId}
                                    introEndsAt={Number(room.state.introEndsAt) || 0}
                                    placementByUserId={room?.state?.placementByUserId ?? {}}
                                />
                            ) : null}
                        />
                    )}
                </div>
            </div>

            {!roomError ? (
                <ChatBox
                    roomId={roomId}
                    userId={profile?.uid}
                    senderName={senderName}
                    isSpectator={isSpectating}
                />
            ) : null}

        </div>
    )
}

export default MatchRoom
