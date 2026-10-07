import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { PiStarFourFill } from "react-icons/pi";
import { FaArrowRotateLeft, FaBoxOpen, FaCheck, FaCopy, FaFire, FaRightFromBracket } from "react-icons/fa6";
import StreakTooltip from "../../../features/profile/components/tooltips/StreakTooltip";
import LevelTooltip from "../../../features/profile/components/tooltips/LevelTooltip";
import Button from './Button'
import { useEconomy } from '../../../features/economy/EconomyContext'
import LumenIcon from '../../../features/economy/components/LumenIcon'
import LumenTooltip from '../../../features/economy/components/tooltips/LumenTooltip'
import RewardCounter from '../../../features/economy/components/RewardCounter'
import useArrivalValue from '../../../features/economy/useArrivalValue'
import { useRewardFx } from '../../../features/economy/RewardFxContext'
import ProgressBar from './ProgressBar';

// Lives only while a crate is being handed over, so it counts up purely from
// what has landed rather than syncing to the wallet behind the animation.
const CrateCounter = ({ startFrom = 0, serverValue = 0, followServer = true }) => {

    // Climbs with the icons on a gain, but still tracks the wallet otherwise so
    // spending a crate is reflected straight away.
    const displayed = useArrivalValue('crates', serverValue, { startFrom, followServer })

    return (
        <RewardCounter kind='crates' className='flex items-center gap-4 px-4 text-neutral1 motion-safe:animate-reward-stat-in'>
            <FaBoxOpen className='text-2xl' />
            <h2>{displayed}</h2>
        </RewardCounter>
    )
}

const Topbar = ({
    profile,
    alwaysShowCrates = false,
    party = null,
    onLeaveParty = null,
    showGameAction = false,
    isGameFinished = false,
    onLeaveGame = null,
    onReturnHome = null,
    gameActionLabel = null,
    gameActionType = null,
}) => {

    const streak = profile?.progress?.streak ?? 0
    const level = profile?.progress?.level ?? 1
    const xp = profile?.progress?.xp ?? 0
    const [copiedPartyCode, setCopiedPartyCode] = useState(false)
    const { snapshot, grantTestReward, resetTestProgress } = useEconomy()
    const { celebrateReward } = useRewardFx()

    const lumenBalance = snapshot?.wallet?.balance ?? 0
    const crateTokens = snapshot?.wallet?.crateTokens ?? 0
    const displayedLumen = useArrivalValue('lumen', lumenBalance)

    // Crates have no permanent slot: the counter only surfaces when the number
    // changes, then fades back out.
    const [crateGain, setCrateGain] = useState(null)
    const previousCratesRef = useRef(null)

    useLayoutEffect(() => {

        const previous = previousCratesRef.current
        previousCratesRef.current = crateTokens

        if(previous == null || crateTokens <= previous) return undefined

        setCrateGain({ from: previous, amount: crateTokens - previous })

        const timeoutId = window.setTimeout(() => setCrateGain(null), 2400)

        return () => window.clearTimeout(timeoutId)

    }, [crateTokens])

    useEffect(() => {

        if(!crateGain) return

        // Fired after the counter has mounted so the icons have a target to fly to.
        const frameId = requestAnimationFrame(() => celebrateReward({ crates: crateGain.amount }))

        return () => cancelAnimationFrame(frameId)

    }, [celebrateReward, crateGain])

    const copyPartyCode = async () => {
        if (!party?.id) return
        await navigator.clipboard.writeText(party.id)
        setCopiedPartyCode(true)
        setTimeout(() => setCopiedPartyCode(false), 1600)
    }

    return (
        <div className="sticky top-0 z-40 bg-neutral6/60 backdrop-blur-xs">
            <div className='text-neutral0 w-full m-auto px-4 sm:px-8 lg:px-16 xl:px-24 pb-4 pt-6 flex justify-between items-center'>

                {showGameAction ? (
                    <Button
                        type={gameActionType ?? (isGameFinished ? 'secondary' : 'negative')}
                        onClick={isGameFinished ? onReturnHome : onLeaveGame}
                    >
                        {gameActionLabel ?? (isGameFinished ? 'Return home' : 'Leave game')}
                    </Button>
                ) : party?.id ? (
                    <div className='flex items-center gap-3 shrink-0'>
                        <Button
                            type='negative'
                            onClick={onLeaveParty}
                            aria-label='Leave party'
                            title='Leave party'
                            className='w-10! h-10! p-0! rounded-xl!'
                        >
                            <FaRightFromBracket className='text-lg rotate-180' />
                        </Button>
                        <button
                            type='button'
                            onClick={() => void copyPartyCode()}
                            className='flex items-center gap-2 text-neutral1 font-semibold hover:text-neutral0 transition cursor-pointer'
                            title='Copy party code'
                        >
                            <span>{party.id}</span>
                            {copiedPartyCode ? <FaCheck className='text-xs' /> : <FaCopy className='text-xs' />}
                        </button>
                    </div>
                ) : <div />}

                <div className="flex items-center gap-2 sm:gap-6 text-sm sm:text-lg font-semibold shrink-0">

                    {import.meta.env.DEV ? (
                        <div className='flex items-center gap-1 p-1 rounded-full bg-neutral5'>
                            <button
                                type='button'
                                title='Grant test XP'
                                onClick={() => { celebrateReward({ xp: 80 }); void grantTestReward({ xp: 80 }) }}
                                className='flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold text-yellow-400 hover:bg-neutral4 transition cursor-pointer'
                            >
                                <PiStarFourFill /> +80
                            </button>

                            <button
                                type='button'
                                title='Grant test Lumen'
                                onClick={() => { celebrateReward({ lumen: 60 }); void grantTestReward({ lumen: 60 }) }}
                                className='flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold text-sky-500 hover:bg-neutral4 transition cursor-pointer'
                            >
                                <LumenIcon className='size-3' /> +60
                            </button>

                            <button
                                type='button'
                                title='Reset level, Lumen and claimed rewards'
                                onClick={() => void resetTestProgress()}
                                className='px-2 py-1 rounded-full text-xs text-neutral1 hover:text-neutral0 hover:bg-neutral4 transition cursor-pointer'
                            >
                                <FaArrowRotateLeft />
                            </button>
                        </div>
                    ) : null}

                    {crateGain || alwaysShowCrates ? (
                        <CrateCounter
                            startFrom={crateGain?.from ?? crateTokens}
                            serverValue={crateTokens}
                            followServer={!crateGain}
                        />
                    ) : null}

                    <LumenTooltip balance={lumenBalance} placement='bottom'>
                        <RewardCounter kind='lumen' className='flex items-center gap-4 px-4 text-sky-500'>
                            <LumenIcon className='size-6' />
                            <h2>{displayedLumen}</h2>
                        </RewardCounter>
                    </LumenTooltip>

                    <StreakTooltip streak={streak}>
                        <div className={`flex items-center gap-4 px-4 ${streak > 0 ? 'text-orange-400' : 'text-neutral1'}`}>
                            <FaFire className="text-2xl" />
                            <h2>{streak}</h2>
                        </div>
                    </StreakTooltip>

                    <LevelTooltip level={level} xp={xp} placement="bottom">
                        <RewardCounter kind='xp' className="flex items-center gap-4 px-4 text-yellow-400">
                            <PiStarFourFill className="text-2xl" />
                            <h2>Lv. {level}</h2>
                        </RewardCounter>
                    </LevelTooltip>


                </div>

            </div>
        </div>
    )

}

export default Topbar;
