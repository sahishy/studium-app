import Button from '../../../shared/components/ui/Button'
import { FaMessage } from 'react-icons/fa6'
import useMobileView from '../../../shared/utils/useMobileView'
import useVisualViewport from '../../../shared/utils/useVisualViewport'
import '../components/mobileGames.css'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router-dom'
import Topbar from '../../../shared/components/ui/Topbar'
import { useMultiplayer } from '../contexts/MultiplayerContext'
import ChatBox from '../components/ChatBox'
import { leaveRoom, subscribeToRoomById, subscribeToRoomPlayers } from '../services/roomService'
import GameHandler from '../games/GameHandler'
import MatchIntroOverlay from '../components/MatchIntroOverlay'
import MatchRewardWatcher from '../components/MatchRewardWatcher'
import { subscribeToGameErrors, subscribeToGameConnection } from '../services/realtimeSocketService'
import ErrorState from '../../../shared/components/ui/ErrorState'
import LoadingState from '../../../shared/components/ui/LoadingState'
import GameFocusBlur from '../components/GameFocusBlur'
import { shouldReturnToPlay } from '../utils/matchRoomNavigation'

const MatchRoom = () => {
    const mobile = useMobileView()
    const viewport = useVisualViewport()
    
    const { roomId } = useParams()
    const [searchParams] = useSearchParams()
    const { profile } = useOutletContext()
    const { session, pendingMatch } = useMultiplayer()
    const navigate = useNavigate()

    const [chatOpen, setChatOpen] = useState(false)
    const [room, setRoom] = useState(null)
    const [roomLoading, setRoomLoading] = useState(true)
    const [players, setPlayers] = useState([])
    const [playersLoading, setPlayersLoading] = useState(true)
    const [roomError, setRoomError] = useState(null)
    const [connectionState, setConnectionState] = useState('connecting')

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
        if(!roomId) {
            setRoom(null)
            setRoomLoading(false)
            return () => {}
        }

        setRoomLoading(true)
        setPlayersLoading(true)
        setRoomError(null)
        setChatOpen(false)
        const unsubscribe = subscribeToRoomById(roomId, setRoom, setRoomLoading)
        const unsubscribePlayers = subscribeToRoomPlayers(roomId, setPlayers, setPlayersLoading)
        const unsubscribeErrors = subscribeToGameErrors(roomId, setRoomError)
        const unsubscribeConnection = subscribeToGameConnection(roomId, setConnectionState)
        return () => {
            unsubscribe()
            unsubscribePlayers()
            unsubscribeErrors()
            unsubscribeConnection()
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
            if(session.status === 'in_room' && session.currentRoomId && pendingMatch?.roomId !== session.currentRoomId) {
                navigate(`/play/game/${session.currentRoomId}`, { replace: true })
            }
            return
        }

        if(shouldReturnToPlay({ session, roomId, roomLoading, playersLoading, isGameFinished, players, userId: profile?.uid })) {
            navigate('/play', { replace: true })
        }
    }, [session, pendingMatch, isGameFinished, isSpectating, roomId, roomLoading, playersLoading, players, profile?.uid, navigate])

    useEffect(() => {
        if(isSpectating && !roomLoading && room && players.length && !spectatedPlayer) {
            setRoomError(new Error('The selected player is not in this match.'))
        }
    }, [isSpectating, players, room, roomLoading, spectatedPlayer])

    return (
        <div className='mp-room relative flex flex-col h-full overflow-hidden' style={mobile ? { height: viewport.height } : undefined}>
            {room?.status === 'active' && !isGameFinished && !roomLoading && !roomError ? (
                <GameFocusBlur />
            ) : null}
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
                gameActionExtras={mobile && !roomError ? (
                    <Button aria-label='Open chat' aria-expanded={chatOpen} disabled={roomLoading} onClick={() => setChatOpen(true)}>
                        <FaMessage className='text-neutral1' />
                    </Button>
                ) : null}
            />

            <div className='mp-room-content w-full flex-1 min-h-0 px-8 xl:px-12 pb-8 pt-2 flex items-center justify-center'>
                <div className='mp-room-game relative w-full max-w-[88rem] h-full min-h-[420px] flex flex-col gap-2'>
                    {!roomLoading && !roomError && connectionState !== 'ready' ? <p role='status' className='text-center text-sm text-neutral1'>Reconnecting…</p> : null}
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
                    key={roomId}
                    windowed={mobile}
                    isOpen={chatOpen}
                    onClose={() => setChatOpen(false)}
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
