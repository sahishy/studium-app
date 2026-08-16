import { useState } from 'react'
import { PiStarFourFill } from "react-icons/pi";
import { FaCheck, FaCopy, FaFire, FaRightFromBracket } from "react-icons/fa6";
import StreakTooltip from "../../../features/profile/components/tooltips/StreakTooltip";
import LevelTooltip from "../../../features/profile/components/tooltips/LevelTooltip";
import Button from './Button'

const Topbar = ({
    profile,
    party = null,
    onLeaveParty = null,
    showGameAction = false,
    isGameFinished = false,
    onLeaveGame = null,
    onReturnHome = null,
}) => {

    const streak = profile?.progress?.streak ?? 0
    const level = profile?.progress?.level ?? 1
    const xp = profile?.progress?.xp ?? 0
    const [copiedPartyCode, setCopiedPartyCode] = useState(false)

    const copyPartyCode = async () => {
        if(!party?.id) return
        await navigator.clipboard.writeText(party.id)
        setCopiedPartyCode(true)
        setTimeout(() => setCopiedPartyCode(false), 1600)
    }

    return (
        <div className="sticky top-0 z-40 bg-neutral6/60 backdrop-blur-xs">
            <div className='text-neutral0 w-full m-auto px-24 pb-4 pt-6 flex justify-between items-center'>

                {showGameAction ? (
                    <Button
                        type={isGameFinished ? 'secondary' : 'negative'}
                        onClick={isGameFinished ? onReturnHome : onLeaveGame}
                    >
                        {isGameFinished ? 'Return home' : 'Leave game'}
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

                <div className="flex gap-8 text-lg font-semibold shrink-0">

                    <StreakTooltip streak={streak}>
                        <div className={`flex items-center gap-4 px-4 ${streak > 0 ? 'text-orange-400' : 'text-neutral1'}`}>
                            <FaFire className="text-2xl" />
                            <h2>{streak}</h2>
                        </div>
                    </StreakTooltip>

                    <LevelTooltip level={level} xp={xp} placement="bottom">
                        <div className="flex items-center gap-4 px-4 text-yellow-400">
                            <PiStarFourFill className="text-2xl" />
                            <h2>Lv. {level}</h2>
                        </div>                        
                    </LevelTooltip>


                </div>

            </div>
        </div>
    )

}

export default Topbar;
