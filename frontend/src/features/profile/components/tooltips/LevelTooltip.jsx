import { PiStarFourFill } from "react-icons/pi";
import BaseTooltip from "../../../../shared/components/tooltips/BaseTooltip";
import Card from "../../../../shared/components/ui/Card";
import ProgressBar from "../../../../shared/components/ui/ProgressBar";
import { getXpToNextLevel, isCrateLevel } from "../../utils/xpUtils";
import { HiChevronDoubleUp } from "react-icons/hi";
import { FaBoxOpen } from "react-icons/fa6";
import LumenIcon from "../../../economy/components/LumenIcon";

const LevelTooltip = ({ children, level, xp, placement = 'auto', className = '', disabled = false }) => {

    const xpToNextLevel = getXpToNextLevel(level)

    const formattedXpLeft = new Intl.NumberFormat('en-US', {
        notation: 'compact',
        maximumFractionDigits: 1
    }).format(xpToNextLevel - xp);


    const nextRewardIsCrate = isCrateLevel(Number(level) + 1)
    // Matches the level rewards in backend/functions/src/features/economy/progression.js.
    const nextRewardQuantity = nextRewardIsCrate ? 1 : 25

    const Tooltip = () => (
        <Card className='p-6'>
            <div className="flex items-center gap-3">
                <PiStarFourFill className="text-6xl text-yellow-400" />
                <div className="flex-1 flex flex-col">
                    <p className="font-bold text-neutral0 text-2xl">Level {level}</p>
                    <p className="font-semibold text-neutral1 text-sm flex items-center gap-1">{formattedXpLeft} xp left <HiChevronDoubleUp/></p>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <ProgressBar
                    value={xp}
                    max={xpToNextLevel}
                    secondaryValue={xp}
                    secondaryMax={xpToNextLevel}
                    className="min-w-0 flex-1"
                    secondaryClassName="bg-yellow-300/45"
                    fillClassName="bg-yellow-400!"
                />
                <span aria-label={`Next level reward: ${nextRewardQuantity} ${nextRewardIsCrate ? 'crate' : 'lumen'}`} className="flex shrink-0 items-center gap-1.5 text-sm font-semibold text-neutral1 tabular-nums">
                    {nextRewardIsCrate ? <FaBoxOpen aria-hidden='true' className='size-4 text-neutral1' /> : <LumenIcon className='size-4' />}
                    {nextRewardQuantity}
                </span>
            </div>
        </Card>
    )

    return (
        <BaseTooltip
            content={<Tooltip />}
            placement={placement}
            className={className}
            disabled={disabled}
        >
            {children}
        </BaseTooltip>
    )

}

export default LevelTooltip;