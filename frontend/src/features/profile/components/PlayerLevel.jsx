import { PiStarFourFill } from 'react-icons/pi'

const PlayerLevel = ({ level = 1, className = '', hasOutline = false }) => (
    <span className={`inline-flex shrink-0 items-center gap-1 ${hasOutline ? 'text-[10px] font-medium text-neutral1' : 'text-xs font-semibold text-neutral1'} tabular-nums ${className}`}>
        <PiStarFourFill className='text-yellow-400 text-sm mr-1' aria-hidden='true'
            style={hasOutline ? {
                stroke: "#451a03",
                strokeWidth: "20px"
            } : undefined}
        />
        Lv. <span className={hasOutline ? 'text-neutral0 text-sm font-semibold' : undefined}>{Math.max(1, Number(level) || 1)}</span>
    </span>
)

export default PlayerLevel
