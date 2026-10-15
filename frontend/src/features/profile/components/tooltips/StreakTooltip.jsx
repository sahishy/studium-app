import { useState } from "react";
import { FaBoxOpen, FaFire } from "react-icons/fa6";
import BaseTooltip from "../../../../shared/components/tooltips/BaseTooltip";
import Card from "../../../../shared/components/ui/Card";
import LumenIcon from "../../../economy/components/LumenIcon";

// Reward cells mirror the level roadmap's claim states exactly, so claiming a streak day and
// claiming a level reward read as the same action in two places rather than two systems.
const DayCell = ({ day, onClaim, claiming }) => {

    const isClaimable = day.state === 'claimable'
    const isClaimed = day.state === 'claimed'
    const isCrate = day.crates > 0

    const icon = isCrate
        ? <FaBoxOpen className='text-[0.7rem]' />
        : <LumenIcon className={`size-3 ${isClaimable ? 'brightness-0 invert' : isClaimed ? 'opacity-70' : 'opacity-30 grayscale'}`} />

    return (
        <div className='flex flex-col items-center gap-1'>

            <span className='text-[0.6rem] font-semibold text-neutral1'>{day.letter}</span>

            <div className='relative flex items-center justify-center'>
                {isClaimable ? (
                    <span className='absolute size-7 rounded-lg border-2 border-sky-400 opacity-60 animate-ping' />
                ) : null}

                <button
                    type='button'
                    disabled={!isClaimable || claiming}
                    onClick={onClaim}
                    aria-label={isClaimable
                        ? `Claim today's streak reward: ${isCrate ? `${day.crates} crate${day.crates === 1 ? '' : 's'}` : `${day.lumen} Lumen`}`
                        : undefined}
                    className={`relative flex size-7 items-center justify-center rounded-lg transition-all
                        ${isClaimable
                            ? 'bg-sky-500 text-white cursor-pointer hover:scale-105'
                            : isClaimed
                                ? 'bg-sky-400/25 text-sky-500/70 cursor-default'
                                : 'bg-neutral5 text-neutral2 cursor-default'}`}
                >
                    {icon}
                </button>
            </div>

            {/* Every day names its amount so the week reads as a roadmap, but only the day the
                student can act on today carries full-contrast text. */}
            <span className={`text-[0.6rem] font-semibold tabular-nums
                ${isClaimable ? 'text-neutral0' : 'text-neutral2'}`}
            >
                {isCrate ? `×${day.crates}` : day.lumen}
            </span>

        </div>
    )
}

const StreakTooltip = ({
    children,
    streak,
    board = null,
    claiming = false,
    onClaim = null,
    placement = 'auto',
    className = '',
    disabled = false,
}) => {

    const [error, setError] = useState('')
    const week = Array.isArray(board?.week) ? board.week : []

    const claim = async () => {
        setError('')

        try {
            await onClaim?.()
        } catch (claimError) {
            setError(claimError?.message || 'Could not claim that reward.')
        }
    }

    const Tooltip = () => (
        <Card className='items-center p-6 gap-5!'>

            <div className="flex items-center gap-6">
                <FaFire className={`text-6xl ${streak > 0 ? 'text-orange-400' : 'text-neutral2'}`} />
                <div className="flex flex-col items-start">
                    <h2 className="font-bold text-5xl">{streak}</h2>
                    <p className="font-semibold text-neutral1 text-sm">day streak</p>
                </div>
            </div>

            {week.length ? (
                <div className='flex items-start gap-1.5'>
                    {week.map((day) => (
                        <DayCell
                            key={day.offset}
                            day={day}
                            onClaim={claim}
                            claiming={claiming}
                        />
                    ))}
                </div>
            ) : null}

            {error ? <p role='alert' className='text-xs text-red-400'>{error}</p> : null}

        </Card>
    )

    return (
        <BaseTooltip
            content={<Tooltip />}
            placement={placement}
            className={className}
            disabled={disabled}
            interactive={Boolean(week.length)}
        >
            {children}
        </BaseTooltip>
    )

}

export default StreakTooltip;
