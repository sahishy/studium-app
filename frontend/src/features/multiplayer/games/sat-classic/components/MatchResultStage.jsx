import AvatarModel from '../../../../../shared/components/avatar/AvatarModel'
import Podium from '../../../../../shared/components/avatar/Podium'
import { getRankInfoFromElo } from '../../../../profile/utils/statsUtils'

const playerProfile = (player) => ({ profile: {
    displayName: player?.displayName,
    profilePicture: player?.profilePicture,
    avatar: player?.avatar,
} })

const ResultPodium = ({ player, outcome, modeId }) => {
    const isWinner = outcome === 'winner'
    const animation = isWinner ? 'Victory' : (outcome === 'loser' ? 'Defeat' : 'Idle')
    const elo = Number(player?.eloByMode?.[modeId]) || 0
    const rank = getRankInfoFromElo(elo)
    return (
        <div className='relative h-full min-w-0'>
            <div className='absolute top-3 left-1/2 z-40 w-[90%] -translate-x-1/2 text-center'>
                <p className='truncate text-sm font-semibold'>{player?.displayName || 'Player'}</p>
                <div className='mt-1 flex items-center justify-center gap-1.5'>
                    <img src={rank.imageSrc} alt={`${rank.name ?? 'Rank'} icon`} className='h-6 w-6 object-cover' />
                    <p className='text-xs font-semibold tabular-nums'>{elo} <span className='text-[10px] font-medium text-neutral1'>SAT</span></p>
                </div>
            </div>
            <AvatarModel
                profile={playerProfile(player)}
                animation={animation}
                className={`absolute left-1/2 z-20 h-[12rem]! w-[12rem]! sm:h-[18rem]! sm:w-[18rem]! max-w-none! -translate-x-1/2 ${isWinner ? '-top-3 sm:top-10' : 'top-1 sm:top-18'}`}
            />
            <Podium
                glow={isWinner}
                className={`absolute left-1/2 z-10 w-36 sm:w-56 max-w-none! -translate-x-1/2 drop-shadow-[0px_20px_14px_rgba(0,0,0,0.12)] ${isWinner ? 'top-22 sm:top-54' : 'top-26 sm:top-62'}`}
            />
        </div>
    )
}

const MatchResultStage = ({ localPlayer, opponent, winnerUserId, modeId }) => {
    const outcomeFor = (player) => !winnerUserId ? 'draw' : (player?.userId === winnerUserId ? 'winner' : 'loser')
    return (
        <div className='relative w-full max-w-3xl h-[20rem] sm:h-[30rem] shrink-0 overflow-hidden grid grid-cols-2 gap-2 sm:gap-8' aria-label='Match result podium'>
            <ResultPodium player={localPlayer} outcome={outcomeFor(localPlayer)} modeId={modeId} />
            <ResultPodium player={opponent} outcome={outcomeFor(opponent)} modeId={modeId} />
            <div className='pointer-events-none absolute inset-x-0 bottom-0 z-30 h-16 sm:h-20 bg-gradient-to-b from-transparent via-neutral6/70 to-neutral6' />
        </div>
    )
}

export default MatchResultStage
