import { FaChevronRight } from 'react-icons/fa6'
import AvatarModel from '../../../../../shared/components/avatar/AvatarModel'
import Podium from '../../../../../shared/components/avatar/Podium'
import AvatarStack from '../../../../../shared/components/avatar/AvatarStack'
import Card from '../../../../../shared/components/ui/Card'
import HtmlContent from '../../../../../shared/components/ui/HtmlContent'
import ProgressBar from '../../../../../shared/components/ui/ProgressBar'
import { useModal } from '../../../../../shared/contexts/ModalContext'
import { formatDurationMmSs } from '../../../../../shared/utils/formatters'
import { getRankInfoFromElo } from '../../../../profile/utils/statsUtils'
import { areGameTeammates } from '../../../utils/multiplayerUtils'
import ChoiceButton from './ChoiceButton'
import { FreeResponseDirections } from './QuestionPane'

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

const RankSection = ({ progression, winnerUserId, eloDelta }) => {
    if(!progression) return <p className='text-sm text-neutral1 mt-6 mb-8'>Private match · ELO unchanged</p>
    const delta = Number(eloDelta ?? progression?.eloDelta) || 0
    const hasNextRank = Boolean(progression?.nextTierThreshold)
    const nextRankInfo = progression?.nextRankInfo ?? (hasNextRank ? getRankInfoFromElo(progression.nextTierThreshold.minElo) : null)
    const peakProgress = progression?.peakProgress ?? Math.max(0, Number(progression?.rankedStats?.peakElo) - Number(progression?.currentTierMinElo))
    return <>
        <h2 className='text-2xl font-bold mt-9 mb-6 underline underline-offset-12 decoration-neutral2'>Your Rank</h2>
        <div className='w-full max-w-xl mb-8 flex flex-col gap-4'>
            <div className='grid grid-cols-2 gap-4'>
                <div className='flex items-center gap-4'>
                    <img src={progression?.rankInfo?.imageSrc} alt={`${progression?.rankLabel ?? 'Current rank'} icon`} className='w-20 h-20 object-cover' />
                    <div className='min-w-0'><p className='text-xs text-neutral1'>Current Rank</p><p className='text-2xl font-semibold truncate'>{progression?.rankLabel ?? 'Unranked'}</p></div>
                </div>
                <div className='flex items-center gap-4 justify-end text-right'>
                    {hasNextRank ? <>
                        <div className='min-w-0'><p className='text-xs text-neutral1'>Next Rank</p><p className='text-2xl font-semibold truncate'>{progression?.nextTierLabel}</p></div>
                        <img src={nextRankInfo?.imageSrc} alt={`${progression?.nextTierLabel ?? 'Next rank'} icon`} className='w-20 h-20 object-cover' />
                    </> : <div><p className='text-xs text-neutral1'>Next Rank</p><p className='text-2xl font-semibold'>Final Rank Reached</p></div>}
                </div>
            </div>
            <div className='flex flex-col gap-2'>
                <div className='flex justify-between'>
                    <p className='text-sm font-semibold'>
                        {Math.max(0, Number(progression?.currentTierProgress) || 0)} <span className='text-xs text-neutral1'>SAT</span>{' '}
                        {winnerUserId && delta !== 0 ? <span className={`text-sm ${delta > 0 ? 'text-sky-400' : 'text-red-400'}`}>{delta > 0 ? `+${delta}` : delta}</span> : null}
                    </p>
                    <p className='text-sm font-semibold'>{Math.max(1, Number(progression?.currentTierSpan) || 1)} <span className='text-xs text-neutral1'>SAT</span></p>
                </div>
                <ProgressBar value={Math.max(0, Number(progression?.currentTierProgress) || 0)} max={Math.max(1, Number(progression?.currentTierSpan) || 1)} secondaryValue={peakProgress} secondaryMax={Math.max(1, Number(progression?.currentTierSpan) || 1)} secondaryClassName='bg-sky-300/40' />
            </div>
        </div>
    </>
}

const QuestionReviewModal = ({ round }) => {
    const question = round.question
    const isSpr = String(question?.questionType ?? '').toLowerCase() === 'spr'
    const isEnglish = String(question?.module ?? '').toLowerCase() !== 'math'
    const hasLeftPane = isSpr || (isEnglish && Boolean(question?.paragraph))
    const submitted = String(round.submittedResponse ?? '').trim()
    const normalizedSubmitted = submitted.toUpperCase()
    const normalizedCorrect = String(round.correctAnswer ?? '').trim().toUpperCase()
    return (
        <div className='flex max-h-[78vh] min-h-[28rem] flex-col gap-5 overflow-hidden'>
            <div>
                <p className='text-xs font-semibold uppercase tracking-wide text-neutral1'>{round.title}</p>
                <h2 className='text-2xl font-bold'>Question Review</h2>
                <p className={`mt-1 text-sm font-semibold ${round.isCorrect ? 'text-green-500' : (submitted ? 'text-red-400' : 'text-neutral1')}`}>{round.isCorrect ? 'Correct' : (submitted ? 'Incorrect' : 'Unanswered')}</p>
            </div>
            <div className={`min-h-0 flex-1 grid gap-6 ${hasLeftPane ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
                {hasLeftPane ? <div className='min-h-0 overflow-y-auto pr-3'>{isSpr ? <FreeResponseDirections /> : <HtmlContent html={question?.paragraph} />}</div> : null}
                <div className={`min-h-0 overflow-y-auto ${hasLeftPane ? 'border-t pt-5 md:border-l md:border-t-0 md:pl-6 md:pt-0 border-neutral2' : 'mx-auto w-full max-w-2xl'}`}>
                    <div className='flex flex-col gap-6'>
                        {question?.body ? <HtmlContent html={question.body} /> : null}
                        <HtmlContent html={question?.prompt || 'Question content is unavailable.'} />
                        {isSpr ? <div className='grid gap-3 sm:grid-cols-2'>
                            <Card className={`gap-1! ${submitted && !round.isCorrect ? 'border-red-500!' : ''}`}><p className='text-xs text-neutral1'>Your answer</p><p className='text-lg font-semibold'>{submitted || 'Unanswered'}</p></Card>
                            <Card className='gap-1! border-green-500!'><p className='text-xs text-neutral1'>Correct answer</p><p className='text-lg font-semibold text-green-500'>{round.correctAnswer ?? '—'}</p></Card>
                        </div> : <div className='flex flex-col gap-3'>
                            {(question?.choices ?? []).map((choice) => {
                                const id = String(choice.id ?? '').toUpperCase()
                                return <ChoiceButton key={choice.id} choice={choice} isSelected={normalizedSubmitted === id} isDisabled isCorrectAnswer={normalizedCorrect === id} isIncorrectSelected={normalizedSubmitted === id && normalizedCorrect !== id} onSelect={() => {}} />
                            })}
                        </div>}
                    </div>
                </div>
            </div>
        </div>
    )
}

const MatchEndOverlay = ({ winnerUserId, userId, modeId, reasonLabel = null, localPlayer, opponent, matchDurationSeconds = 0, questionsAnswered = 0, rankedProgression = null, eloDelta = null, players = [], rounds = [] }) => {
    const { openModal } = useModal()
    const isDraw = !winnerUserId
    const isMyWin = winnerUserId === userId
    const title = isDraw ? 'Draw' : (isMyWin ? 'Victory' : 'Defeat')
    const openReview = (round) => round.question && openModal({ content: <QuestionReviewModal round={round} />, maxWidthClass: 'max-w-6xl mx-4' })
    return (
        <div className='w-full h-full min-h-[420px] flex flex-col items-center px-4 sm:px-6 py-10 overflow-y-auto'>
            <div className='text-center mb-4'>
                <p className={`text-5xl font-bold ${isDraw ? 'text-neutral1' : isMyWin ? 'text-sat0' : 'text-red-400'} leading-none mb-2`}>{title}</p>
                {reasonLabel ? <p className='text-sm text-neutral1'>{reasonLabel}</p> : null}
            </div>
            <MatchResultStage localPlayer={localPlayer} opponent={opponent} winnerUserId={winnerUserId} modeId={modeId} />
            <RankSection progression={rankedProgression} winnerUserId={winnerUserId} eloDelta={eloDelta} />
            <h2 className='text-2xl font-bold mt-9 mb-6 underline underline-offset-12 decoration-neutral2'>Match Overview</h2>
            <div className='w-full max-w-xl grid grid-cols-2 gap-4'>
                <Card className='items-center gap-1! text-center'><p className='text-2xl font-semibold tabular-nums'>{formatDurationMmSs(Math.max(0, Number(matchDurationSeconds) || 0))}</p><p className='text-sm text-neutral1'>Match Duration</p></Card>
                <Card className='items-center gap-1! text-center'><p className='text-2xl font-semibold tabular-nums'>{Math.max(0, Number(questionsAnswered) || 0)}</p><p className='text-sm text-neutral1'>Questions Answered</p></Card>
            </div>
            <h2 className='text-2xl font-bold mt-12 mb-6 underline underline-offset-12 decoration-neutral2'>Game Rounds</h2>
            <div className='w-full max-w-4xl flex flex-col gap-3'>
                {rounds.map((round) => {
                    const winners = players.filter((player) => round.winnerUserIds?.includes(player.userId))
                    const localWinners = winners.filter((player) => areGameTeammates(player, localPlayer))
                    const opposingWinners = winners.filter((player) => !areGameTeammates(player, localPlayer))
                    const isQuestion = round.kind === 'question'
                    const submitted = String(round.submittedResponse ?? '').trim()
                    const status = round.isCorrect ? 'Correct' : (submitted ? 'Incorrect' : 'Unanswered')
                    const roundCard = <Card className={`w-full min-w-0 gap-1! items-center text-center ${isQuestion && round.question ? 'hover:bg-neutral5 transition-colors' : ''}`}>
                        <div className='flex items-center justify-center gap-2'><p className='text-sm font-semibold'>{round.title}</p>{isQuestion && round.question ? <FaChevronRight className='text-xs text-neutral1' /> : null}</div>
                        {isQuestion ? <p className='text-xs text-neutral1'><span className={round.isCorrect ? 'text-green-500' : (submitted ? 'text-red-400' : '')}>{status}</span>{' · '}Your answer: {submitted || '—'}{' · '}Correct answer: {round.correctAnswer ?? '—'}{!round.question ? ' · Review unavailable' : ''}</p> : <p className='text-xs text-neutral1'>{round.summary}</p>}
                    </Card>
                    return <div key={round.id} className='w-full flex items-center gap-2 sm:gap-4'>
                        <div className='w-12 sm:w-32 shrink-0 flex justify-end'><AvatarStack users={localWinners} maxVisible={4} sizeClassName='w-10 h-10' /></div>
                        {isQuestion ? <button type='button' className='flex-1 min-w-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-70' onClick={() => openReview(round)} disabled={!round.question}>{roundCard}</button> : <div className='flex-1 min-w-0'>{roundCard}</div>}
                        <div className='w-12 sm:w-32 shrink-0 flex justify-start'><AvatarStack users={opposingWinners} maxVisible={4} sizeClassName='w-10 h-10' /></div>
                    </div>
                })}
                {!rounds.length ? <p className='text-center text-sm text-neutral1'>No rounds found.</p> : null}
            </div>
        </div>
    )
}

export default MatchEndOverlay
