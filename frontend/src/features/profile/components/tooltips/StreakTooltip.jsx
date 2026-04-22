import { FaFire } from "react-icons/fa6";
import BaseTooltip from "../../../../shared/components/tooltips/BaseTooltip";
import Card from "../../../../shared/components/ui/Card";

const StreakTooltip = ({ children, streak, placement = 'auto', className = '', disabled = false }) => {

    const Tooltip = () => (
        <Card className='items-center p-6'>
            <div className="flex items-center gap-6">
                <FaFire className="text-6xl text-orange-400" />
                <div className="flex flex-col items-start">
                    <h2 className="font-bold text-5xl">{streak}</h2>
                    <p className="font-semibold text-neutral1 text-sm">day streak</p>
                </div>                
            </div>

            <p className="text-neutral1 text-sm">Keep staying productive!</p>
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

export default StreakTooltip;