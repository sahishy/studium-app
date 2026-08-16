import AvatarStack from '../../../../../shared/components/avatar/AvatarStack'
import HealthPanel from './HealthPanel'
import { formatDurationMmSs } from '../../../../../shared/utils/formatters'
import Card from '../../../../../shared/components/ui/Card'
import ProgressBar from '../../../../../shared/components/ui/ProgressBar'
import { areGameTeammates } from '../../../utils/multiplayerUtils'

const MatchEndOverlay = ({
    winnerUserId,
    userId,
    endReason = null,
    healthBoard,
    matchDurationSeconds = 0,
    rankedProgression,
    rounds = [],
}) => {

    const leftPlayer = healthBoard?.leftPlayer ?? null
    const rightPlayer = healthBoard?.rightPlayer ?? null
    const localPlayer = [leftPlayer, rightPlayer].find((player) => player?.userId === userId) ?? null
    const isDraw = !winnerUserId
    const isMyWin = !isDraw && winnerUserId === userId
    const eloDelta = Number(rankedProgression?.eloDelta) || 0
    const eloDeltaLabel = eloDelta > 0 ? `+${eloDelta}` : `${eloDelta}`

    const title = isDraw ? 'Draw' : (isMyWin ? 'Victory' : 'Defeat')
    const reasonLabel = endReason === 'knockout'
        ? (isMyWin ? 'You bested your opponent.' : 'You lost all of your health.')
        : (endReason === 'max_questions'
            ? 'Reached max questions'
            : (endReason === 'player_left'
                ? (isMyWin ? 'Your opponent left the match.' : 'You left the match.')
                : null))

    const hasNextRank = Boolean(rankedProgression?.nextTierThreshold)

    return (
        <div className='w-full h-full min-h-[420px] flex flex-col items-center px-6 py-10 overflow-y-auto'>
            <div className='text-center mb-8'>
                <p className={`text-5xl font-bold ${isDraw ? 'text-neutral1' : isMyWin ? 'text-sat0' : 'text-red-400'} leading-none mb-2`}>{title}</p>
                {reasonLabel ? <p className='text-sm text-neutral1'>{reasonLabel}</p> : null}
            </div>

            <div className='w-full max-w-4xl mb-6 flex items-center justify-between gap-6'>
                <HealthPanel player={leftPlayer} />

                <div className='shrink-0 text-center'>
                    <p className='text-2xl font-semibold tabular-nums'>
                        {formatDurationMmSs(Math.max(0, Number(matchDurationSeconds) || 0))}
                    </p>
                    <p className='text-sm text-neutral1'>Match Duration</p>
                </div>

                <HealthPanel player={rightPlayer} align='end' />
            </div>

            {rankedProgression ? <>
                <h2 className='text-2xl font-bold mt-9 mb-6 underline underline-offset-12 decoration-neutral2'>Your Rank</h2>

                <div className='w-full max-w-xl mb-8 flex flex-col gap-4'>
                <div className='grid grid-cols-2 gap-4'>
                    <div className='flex items-center gap-4'>
                        <img
                            src={rankedProgression?.rankInfo?.imageSrc}
                            alt={`${rankedProgression?.rankLabel ?? 'Current rank'} icon`}
                            className='w-20 h-20 object-cover'
                        />
                        <div className='min-w-0'>
                            <p className='text-xs text-neutral1'>Current Rank</p>
                            <p className='text-2xl font-semibold truncate'>{rankedProgression?.rankLabel ?? 'Unranked'}</p>
                        </div>
                    </div>

                    <div className='flex items-center gap-4 justify-end text-right'>
                        {hasNextRank ? (
                            <>
                                <div className='min-w-0'>
                                    <p className='text-xs text-neutral1'>Next Rank</p>
                                    <p className='text-2xl font-semibold truncate'>{rankedProgression?.nextTierLabel}</p>
                                </div>
                                <img
                                    src={rankedProgression?.nextRankInfo?.imageSrc}
                                    alt={`${rankedProgression?.nextTierLabel ?? 'Next rank'} icon`}
                                    className='w-20 h-20 object-cover'
                                />
                            </>
                        ) : (
                            <div>
                                <p className='text-xs text-neutral1'>Next Rank</p>
                                <p className='text-2xl font-semibold'>Final Rank Reached</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className='flex flex-col gap-2'>
                    <div className='flex justify-between'>
                        <p className='text-sm font-semibold'>
                            {Math.max(0, Number(rankedProgression?.currentTierProgress) || 0)}{' '}
                            <span className='text-xs text-neutral1'>SAT</span>{' '}
                            {!isDraw && eloDelta !== 0 && (
                                <span className={`text-sm ${eloDelta > 0 ? 'text-sky-400' : 'text-red-400'}`}>
                                    {eloDeltaLabel}
                                </span>
                            )}
                        </p>
                    <p className='text-sm font-semibold'>
                            {Math.max(1, Number(rankedProgression?.currentTierSpan) || 1)} <span className='text-xs text-neutral1'>SAT</span>
                        </p>
                    </div>

                    <ProgressBar
                        value={Math.max(0, Number(rankedProgression?.currentTierProgress) || 0)}
                        max={Math.max(1, Number(rankedProgression?.currentTierSpan) || 1)}
                        secondaryValue={Math.max(0, Number(rankedProgression?.peakProgress) || 0)}
                        secondaryMax={Math.max(1, Number(rankedProgression?.currentTierSpan) || 1)}
                        secondaryClassName='bg-sky-300/40'
                    />                    
                </div>

                </div>
            </> : <p className='text-sm text-neutral1 mt-6 mb-8'>Private match · ELO unchanged</p>}

            <h2 className='text-2xl font-bold mt-9 mb-6 underline underline-offset-12 decoration-neutral2'>Game Rounds</h2>

            <div className='w-full max-w-4xl flex flex-col gap-3'>
                {rounds.map((roundEntry) => {
                    const correctPlayers = roundEntry.correctPlayers ?? []
                    const localTeamPlayers = correctPlayers.filter((player) => areGameTeammates(player, localPlayer))
                    const opposingTeamPlayers = correctPlayers.filter((player) => !areGameTeammates(player, localPlayer))
                    return (
                    <div key={roundEntry.id} className='w-full flex items-center gap-4'>
                        <div className='w-32 shrink-0 flex justify-end'>
                            <AvatarStack users={localTeamPlayers} maxVisible={4} sizeClassName='w-10 h-10' />
                        </div>
                        <Card className='flex-1 min-w-0 gap-1! items-center'>
                            <p className='text-sm font-semibold'>Round {roundEntry.roundNumber}</p>
                            <p className='text-xs text-neutral1'>Correct Answer: {roundEntry.correctAnswer ?? '—'}. Explanations coming soon.</p>
                        </Card>
                        <div className='w-32 shrink-0 flex justify-start'>
                            <AvatarStack users={opposingTeamPlayers} maxVisible={4} sizeClassName='w-10 h-10' />
                        </div>
                    </div>
                    )
                })}
                {!rounds.length ? (
                    <p className='text-center text-sm text-neutral1'>No rounds found.</p>
                ) : null}
            </div>
        </div>
    )

}

export default MatchEndOverlay
