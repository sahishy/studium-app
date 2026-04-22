import { PiStarFourFill } from "react-icons/pi";
import BaseTooltip from "../../../../shared/components/tooltips/BaseTooltip";
import Card from "../../../../shared/components/ui/Card";
import ProgressBar from "../../../../shared/components/ui/ProgressBar";
import { getXpToNextLevel } from "../../utils/xpUtils";
import { HiChevronDoubleUp } from "react-icons/hi";

const LevelTooltip = ({ children, level, xp, placement = 'auto', className = '', disabled = false }) => {

    const xpToNextLevel = getXpToNextLevel(level)

    const Tooltip = () => (
        <Card className='p-6'>
            <div className="flex items-center gap-3">
                <PiStarFourFill className="text-6xl text-yellow-400" />
                <div className="flex-1 flex flex-col">
                    <p className="font-bold text-neutral0 text-2xl">Level {level}</p>
                    <p className="font-semibold text-neutral1 text-sm flex items-center gap-1">{xpToNextLevel - xp} xp left <HiChevronDoubleUp/></p>
                </div>
            </div>

            <div>
                <ProgressBar
                    value={xp}
                    max={xpToNextLevel}
                    className="w-32"
                    fillClassName="bg-yellow-400!"
                />
            </div>

            <p className="text-neutral1 text-sm">Complete tasks or play games!</p>
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