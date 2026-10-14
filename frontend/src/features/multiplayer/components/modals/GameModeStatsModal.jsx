import Button from '../../../../shared/components/ui/Button'

const GameModeStatsModal = ({ mode, gamesPlayed = 0, closeModal }) => {
    const ModeIcon = mode.icon
    const count = Math.max(0, Math.floor(Number(gamesPlayed) || 0))

    return (
        <div className='flex flex-col items-center gap-6'>
            <div className='flex items-center gap-2'>
                <ModeIcon className='text-lg text-neutral1' />
                <h1 className='text-xl font-semibold'>{mode.name} stats</h1>
            </div>
            <div className='flex flex-col items-center gap-1 py-2'>
                <p className='text-4xl font-bold tabular-nums'>{count.toLocaleString()}</p>
                <p className='text-sm text-neutral1'>Games played</p>
            </div>
            <Button type='secondary' className='w-full py-4' onClick={closeModal}>Close</Button>
        </div>
    )
}

export default GameModeStatsModal
