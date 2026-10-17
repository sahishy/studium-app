import TextTooltip from '../../../shared/components/tooltips/TextTooltip'
import { MODE_THUMBNAILS } from '../utils/modeThumbnails'

const GameModeThumbnail = ({ mode, disabled = false, disabledReason = 'Party Leader Only', onClick }) => {
    const ModeIcon = mode.icon
    const thumbnail = MODE_THUMBNAILS[mode.id]
    const artworkClass = `relative z-10 w-full rounded-xl border border-neutral4 shadow-lg shadow-shadow opacity-70 transition-[translate,opacity] duration-400 ease-in-out  ${disabled ? '' : 'group-hover:-translate-y-2 group-hover:opacity-100 group-has-[.gamemode-trigger:hover]/mode:-translate-y-2 group-has-[.gamemode-trigger:hover]/mode:opacity-100 group-has-[.gamemode-trigger:focus-visible]/mode:-translate-y-2 group-has-[.gamemode-trigger:focus-visible]/mode:opacity-100 group-focus-visible:-translate-y-2 group-focus-visible:opacity-100'}`

    return (
        <TextTooltip text={disabled ? disabledReason : 'Change gamemode'} placement='top' gap={16} className='relative z-0 block w-[80%] mx-auto -mb-10 -translate-y-4'>
            <button
                type='button'
                aria-label='Change gamemode'
                disabled={disabled}
                onClick={onClick}
                className='group relative isolate block w-full rounded-xl bg-transparent p-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neutral2 disabled:cursor-not-allowed'
            >
                <span aria-hidden='true' className={`pointer-events-none absolute inset-0 -translate-x-3.5 translate-y-3 -rotate-4 rounded-xl border border-neutral4/60 bg-neutral3/40 transition-[rotate] duration-400 ease-in-out ${disabled ? '' : 'group-hover:-rotate-7 group-has-[.gamemode-trigger:hover]/mode:-rotate-7 group-has-[.gamemode-trigger:focus-visible]/mode:-rotate-7 group-focus-visible:-rotate-7'}`} />
                <span aria-hidden='true' className={`pointer-events-none absolute inset-0 translate-x-3.5 translate-y-3 rotate-4 rounded-xl border border-neutral4/60 bg-neutral3/40 transition-[rotate] duration-400 ease-in-out ${disabled ? '' : 'group-hover:rotate-7 group-has-[.gamemode-trigger:hover]/mode:rotate-7 group-has-[.gamemode-trigger:focus-visible]/mode:rotate-7 group-focus-visible:rotate-7'}`} />
                {thumbnail ? (
                    <img src={thumbnail} alt='' className={`${artworkClass} block h-auto`} />
                ) : (
                    <span className={`${artworkClass} flex aspect-[16/10] items-center justify-center bg-neutral5`}>
                        <ModeIcon className='text-5xl text-neutral1' aria-hidden='true' />
                    </span>
                )}
            </button>
        </TextTooltip>
    )
}

export default GameModeThumbnail
