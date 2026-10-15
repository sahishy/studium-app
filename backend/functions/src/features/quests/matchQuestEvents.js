import { isRewardEligible } from '../economy/progression.js'
import { SAT_DOMAINS } from '../mastery/masteryService.js'

const count = (value) => Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0

// One result produces one batch for the quest transaction; losses still contribute actions.
const buildMatchQuestEvents = (result, userId, performance = {}, gameplay = {}) => {
    if(!isRewardEligible(result, userId)) return []
    const events = [
        { metric: 'match_played', amount: 1 },
        { metric: `mode:${result.modeId}`, amount: 1 },
        { metric: 'round_won', amount: count(performance.roundsWon) },
        { metric: 'question_correct', amount: count(performance.correct) },
    ]
    for(const section of ['math', 'reading']) {
        const correct = SAT_DOMAINS.filter((domain) => domain.section === section)
            .reduce((total, domain) => total + count(performance.byDomain?.[domain.id]?.correct), 0)
        events.push({ metric: `${section}_question_correct`, amount: correct })
    }
    const action = {
        'sat-timber': ['timber_log_chopped', 'timberLogsChopped'],
        'sat-puncture': ['puncture_pin_placed', 'puncturePinsPlaced'],
        'sat-flutter': ['flutter_ring_cleared', 'flutterRingsCleared'],
    }[result.modeId]
    if(action) events.push({ metric: action[0], amount: count(gameplay[action[1]]) })
    if(result.winnerUserId === userId) {
        events.push({ metric: 'match_won', amount: 1 })
        if(['sat-timber', 'sat-puncture'].includes(result.modeId)
            && gameplay.trackedFromStart === true && gameplay.stuns === 0) {
            events.push({ metric: result.modeId === 'sat-timber' ? 'timber_clean_win' : 'puncture_clean_win', amount: 1 })
        }
    }
    return events.filter((event) => event.amount > 0)
}

export { buildMatchQuestEvents }
