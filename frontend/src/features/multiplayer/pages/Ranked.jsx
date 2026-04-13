import { useEffect, useRef, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import Topbar from '../../../shared/components/ui/Topbar'
import Button from '../../../shared/components/ui/Button'
import Card from '../../../shared/components/ui/Card'
import AvatarModel from '../../../shared/components/avatar/AvatarModel'
import ProgressBar from '../../../shared/components/ui/ProgressBar'
import { useUserStats } from '../../profile/contexts/UserStatsContext'
import { useMultiplayer } from '../contexts/MultiplayerContext'
import { useToast } from '../../../shared/contexts/ToastContext'
import MatchmakingToast from '../components/toasts/MatchmakingToast'
import podium from '../../../assets/images/podium.png'
import { HiChevronDoubleUp } from 'react-icons/hi'
import {
    buildRankedUiState,
    DEFAULT_MODE_ID,
    getQueueState,
    MATCH_JOIN_DELAY_SECONDS,
} from '../utils/multiplayerUtils'

const Ranked = () => {

    const { profile } = useOutletContext()
    const navigate = useNavigate()
    const { userStats } = useUserStats()
    const { matchmaking, session, joinQueue, leaveQueue, findMatch } = useMultiplayer()
    const { toastStack, showToast, updateToast, hideToast } = useToast()
    const [matchCountdownSeconds, setMatchCountdownSeconds] = useState(MATCH_JOIN_DELAY_SECONDS)
    const matchmakingToastIdRef = useRef(null)
    const autoJoinRoomIdRef = useRef(null)

    const {
        rankedStats,
        rankInfo,
        currentTierMinElo,
        currentTierSpan,
        currentTierProgress,
        eloToNextTier,
        rankLabel,
        nextTierLabel,
        nextTierThreshold,
    } = buildRankedUiState({ userStats, modeId: DEFAULT_MODE_ID })

    const queueState = getQueueState(session)

    useEffect(() => {
        if(queueState === 'idle') {
            return
        }

        const existingMatchmakingToasts = toastStack.filter((toastEntry) => toastEntry.component === MatchmakingToast)

        if(existingMatchmakingToasts.length === 0) {
            return
        }

        const currentToastStillExists = existingMatchmakingToasts.some((toastEntry) => toastEntry.id === matchmakingToastIdRef.current)
        if(!currentToastStillExists) {
            matchmakingToastIdRef.current = existingMatchmakingToasts[0].id
        }

        existingMatchmakingToasts.forEach((toastEntry) => {
            if(toastEntry.id !== matchmakingToastIdRef.current) {
                hideToast(toastEntry.id, { force: true })
            }
        })
    }, [queueState, toastStack, hideToast])

    const handleLeaveQueue = async () => {
        await leaveQueue()

        if(matchmakingToastIdRef.current) {
            hideToast(matchmakingToastIdRef.current, { force: true })
            matchmakingToastIdRef.current = null
        }
    }

    const showOrUpdateMatchmakingToast = (state) => {
        if(!matchmakingToastIdRef.current) {
            const existingMatchmakingToasts = toastStack.filter((toastEntry) => toastEntry.component === MatchmakingToast)
            if(existingMatchmakingToasts.length > 0) {
                matchmakingToastIdRef.current = existingMatchmakingToasts[0].id
            }
        }

        if(matchmakingToastIdRef.current) {
            const toastExists = toastStack.some((toastEntry) => toastEntry.id === matchmakingToastIdRef.current)
            if(!toastExists) {
                matchmakingToastIdRef.current = null
            }
        }

        const toastProps = {
            state,
            queuedAt: matchmaking?.queuedAt,
            matchCountdownSeconds,
            onLeaveQueue: handleLeaveQueue,
        }

        if(!matchmakingToastIdRef.current) {
            const toastId = showToast({
                component: MatchmakingToast,
                props: toastProps,
                duration: null,
            })

            matchmakingToastIdRef.current = toastId
            return
        }

        updateToast(matchmakingToastIdRef.current, {
            props: toastProps,
            duration: null,
        })
    }

    const handlePlayClick = async () => {

        if(!profile?.uid || queueState !== 'idle') {
            return
        }

        await joinQueue({
            modeId: DEFAULT_MODE_ID,
            elo: rankedStats.elo,
            displayName: profile?.profile?.displayName || 'A player',
            profilePicture: profile?.profile?.profilePicture ?? null,
        })

        await findMatch({
            modeId: DEFAULT_MODE_ID,
        })
    }

    useEffect(() => {
        if(queueState !== 'matched' || !session?.currentRoomId) {
            autoJoinRoomIdRef.current = null
            setMatchCountdownSeconds(MATCH_JOIN_DELAY_SECONDS)
            return
        }

        if(autoJoinRoomIdRef.current !== session.currentRoomId) {
            autoJoinRoomIdRef.current = session.currentRoomId
            setMatchCountdownSeconds(MATCH_JOIN_DELAY_SECONDS)
        }
    }, [queueState, session?.currentRoomId])

    useEffect(() => {
        if(queueState !== 'matched' || !session?.currentRoomId) {
            return
        }

        if(matchCountdownSeconds <= 0) {
            if(matchmakingToastIdRef.current) {
                hideToast(matchmakingToastIdRef.current, { force: true })
                matchmakingToastIdRef.current = null
            }
            navigate(`/ranked/room/${session.currentRoomId}`)
            return
        }

        const timeoutId = setTimeout(() => {
            setMatchCountdownSeconds((previous) => previous - 1)
        }, 1000)

        return () => clearTimeout(timeoutId)
    }, [queueState, session?.currentRoomId, matchCountdownSeconds, navigate, hideToast])

    useEffect(() => {
        if(queueState === 'idle') {
            if(matchmakingToastIdRef.current) {
                hideToast(matchmakingToastIdRef.current, { force: true })
                matchmakingToastIdRef.current = null
            }
            return
        }

        showOrUpdateMatchmakingToast(queueState === 'matched' ? 'matched' : 'queueing')
    }, [queueState, matchCountdownSeconds, matchmaking?.queuedAt])

    return (
        <div className='flex flex-col h-full overflow-hidden'>
            <Topbar profile={profile} />

            <div className='w-full flex-1 flex min-h-0 px-24 pb-24 pt-2 gap-8'>

                <div className='relative flex-1 flex items-center justify-center min-h-0'>
                    <img src={podium} className='absolute -bottom-52' />
                    <AvatarModel
                        profile={profile}
                        animation={'Idle'}
                        className='w-[36rem]! h-[36rem]!'
                    />
                </div>

                <div className='flex-1 min-h-0 flex flex-col justify-center gap-8'>

                    <Card className='max-w-xl p-8! gap-3'>
                        <div className='flex flex-col items-center gap-3'>

                            <div className="w-32 h-32 overflow-hidden flex items-center justify-center">
                                <img
                                    src={rankInfo.imageSrc}
                                    alt={`${rankLabel} icon`}
                                    className='w-32 h-32 object-cover'
                                />
                            </div>

                            <h2 className='text-2xl font-semibold'>{rankLabel}</h2>

                        </div>

                        <ProgressBar
                            value={currentTierProgress}
                            max={currentTierSpan}
                            secondaryValue={Math.max(0, rankedStats.peakElo - currentTierMinElo)}
                            secondaryMax={currentTierSpan}
                            secondaryClassName='bg-sky-300/40'
                        />

                        <div className='flex justify-between'>
                            <p className='text-sm font-semibold'>
                                {rankedStats.elo} <span className='text-xs text-neutral1'>SAT</span>
                            </p>
                            <p className='text-sm text-text2 flex items-center gap-1'>
                                <HiChevronDoubleUp />
                                {nextTierThreshold ? `${eloToNextTier} to ${nextTierLabel}` : nextTierLabel}
                            </p>
                        </div>

                    </Card>

                    <Button
                        type='primary'
                        className='p-6! text-2xl!'
                        onClick={handlePlayClick}
                        disabled={queueState !== 'idle'}
                    >
                        {queueState === 'queueing' ? 'Queueing...' : queueState === 'matched' ? 'Joining...' : 'Play'}
                    </Button>
                </div>
            </div>
        </div>
    )

}

export default Ranked
