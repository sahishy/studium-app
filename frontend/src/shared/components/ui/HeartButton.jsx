import { FaHeart } from 'react-icons/fa6'

const HeartButton = ({ active, count = 0, disabled, onClick, label }) => (
    <button
        type='button'
        onClick={onClick}
        disabled={disabled}
        aria-label={`${active ? 'Remove heart from' : 'Heart'} ${label}`}
        aria-pressed={Boolean(active)}
        className={`flex shrink-0 items-center gap-1.5 p-2 text-xs font-semibold transition-colors cursor-pointer
            disabled:opacity-40 disabled:cursor-not-allowed
            ${active ? 'text-red-400' : 'text-neutral1 hover:text-red-400'}`}
    >
        <FaHeart />
        {Number(count) > 0 ? <span>{count}</span> : null}
    </button>
)

export default HeartButton
