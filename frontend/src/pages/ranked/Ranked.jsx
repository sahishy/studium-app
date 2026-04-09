import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import Topbar from '../../components/main/Topbar'
import Button from '../../components/main/Button'
import Card from '../../components/main/Card'
import AvatarModel from '../../components/avatar/AvatarModel'
import ProgressBar from '../../components/main/ProgressBar'
import { useUserStats } from '../../contexts/UserStatsContext'
import { useMultiplayer } from '../../contexts/MultiplayerContext'
import { useToast } from '../../contexts/ToastContext'
import MatchmakingToast from '../../components/toasts/MatchmakingToast'
import { RANK_TIERS, getRankInfoFromElo, getRankedModeStats } from '../../utils/statsUtils'
import podium from '../../assets/images/podium.png'
import { HiChevronDoubleUp } from 'react-icons/hi'

const DEFAULT_MODE_ID = 'sat_1v1'
const MATCH_JOIN_DELAY_SECONDS = 3

const Ranked = () => {

    const { profile } = useOutletContext()
    const navigate = useNavigate()
    const { userStats } = useUserStats()
    const { matchmaking, session, joinQueue, leaveQueue, findMatch } = useMultiplayer()
    const { showToast, updateToast, hideToast } = useToast()
    const [nowMs, setNowMs] = useState(Date.now())
    const [matchCountdownSeconds, setMatchCountdownSeconds] = useState(MATCH_JOIN_DELAY_SECONDS)
    const matchmakingToastIdRef = useRef(null)
    const autoJoinRoomIdRef = useRef(null)

    const rankedStats = getRankedModeStats(userStats, DEFAULT_MODE_ID)
    const rankInfo = getRankInfoFromElo(rankedStats.elo)

    const currentTierThreshold = RANK_TIERS.find((entry) => (
        entry.tierName === rankInfo.tierName
        && entry.tier === rankInfo.tier
    )) ?? RANK_TIERS[RANK_TIERS.length - 1]

    const ascendingTiers = [...RANK_TIERS].sort((a, b) => a.minElo - b.minElo)
    const nextTierThreshold = ascendingTiers.find((entry) => entry.minElo > rankedStats.elo)

    const currentTierMinElo = currentTierThreshold.minElo
    const nextTierMinElo = nextTierThreshold?.minElo ?? (currentTierMinElo + 100)
    const currentTierSpan = Math.max(1, nextTierMinElo - currentTierMinElo)
    const currentTierProgress = Math.max(0, rankedStats.elo - currentTierMinElo)
    const eloToNextTier = Math.max(0, nextTierMinElo - rankedStats.elo)

    const rankLabel = rankInfo.tier ? `${rankInfo.tierName} ${rankInfo.tier}` : rankInfo.tierName
    const nextTierLabel = nextTierThreshold
        ? `${nextTierThreshold.tierName} ${nextTierThreshold.tier}`
        : 'Max tier reached'

    const queueState = session?.status === 'in_room'
        ? 'matched'
        : (session?.status === 'queue' ? 'queueing' : 'idle')

    const isQueueing = queueState === 'queueing'

    const queueTimeSeconds = useMemo(() => {
        const queuedAtMs = matchmaking?.queuedAt?.toDate
            ? matchmaking.queuedAt.toDate().getTime()
            : null

        if(!queuedAtMs || !isQueueing) {
            return 0
        }

        return Math.max(0, Math.floor((nowMs - queuedAtMs) / 1000))
    }, [matchmaking?.queuedAt, isQueueing, nowMs])

    const queueTimeLabel = useMemo(() => {
        const minutes = Math.floor(queueTimeSeconds / 60)
        const seconds = queueTimeSeconds % 60
        return `${minutes}:${seconds.toString().padStart(2, '0')}`
    }, [queueTimeSeconds])

    const handleLeaveQueue = async () => {
        await leaveQueue()

        if(matchmakingToastIdRef.current) {
            hideToast(matchmakingToastIdRef.current, { force: true })
            matchmakingToastIdRef.current = null
        }
    }

    const showOrUpdateMatchmakingToast = (state) => {
        const toastProps = {
            state,
            queueTimeLabel,
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
        })

        showOrUpdateMatchmakingToast('queueing')

        await findMatch({
            modeId: DEFAULT_MODE_ID,
        })
    }

    useEffect(() => {
        if(!isQueueing) {
            return
        }

        const intervalId = setInterval(() => {
            setNowMs(Date.now())
        }, 1000)

        return () => clearInterval(intervalId)
    }, [isQueueing])

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
    }, [queueState, queueTimeLabel, matchCountdownSeconds])

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

                            <div className="w-16 h-16 overflow-hidden flex items-center justify-center">
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
