import assert from 'node:assert/strict'
import test from 'node:test'
import { buildMatchQuestEvents } from './matchQuestEvents.js'
import { sanitizeRealtimeResult } from '../realtime/resultUtils.js'

const result = {
    modeId: 'sat-timber', ranked: true, roundsPlayed: 3, endReason: 'first_to_three',
    winnerUserId: 'player', participationByUserId: { player: 3 },
}
const metrics = (...args) => Object.fromEntries(buildMatchQuestEvents(...args).map(({ metric, amount }) => [metric, amount]))

test('a losing match contributes rounds, correct answers and subject totals', () => {
    const events = metrics({ ...result, winnerUserId: 'opponent' }, 'player', {
        roundsWon: 2, correct: 8, byDomain: {
            Algebra: { correct: 2 }, 'Advanced Math': { correct: 1 },
            'Craft and Structure': { correct: 2 }, 'Standard English Conventions': { correct: 1 },
            Unknown: { correct: 2 },
        },
    }, { timberLogsChopped: 45 })
    assert.equal(events.round_won, 2)
    assert.equal(events.question_correct, 8)
    assert.equal(events.math_question_correct, 3)
    assert.equal(events.reading_question_correct, 3)
    assert.equal(events.timber_log_chopped, 45)
    assert.equal(events.match_won, undefined)
    assert.equal(events.timber_clean_win, undefined)
})

test('clean wins require a whole tracked match, a win, and zero stuns', () => {
    for(const [modeId, metric] of [['sat-timber', 'timber_clean_win'], ['sat-puncture', 'puncture_clean_win']]) {
        assert.equal(metrics({ ...result, modeId }, 'player', {}, { trackedFromStart: true, stuns: 0 })[metric], 1)
        for(const gameplay of [{}, { stuns: 0 }, { trackedFromStart: false, stuns: 0 }, { trackedFromStart: true, stuns: 1 }]) {
            assert.equal(metrics({ ...result, modeId }, 'player', {}, gameplay)[metric], undefined)
        }
        assert.equal(metrics({ ...result, modeId, winnerUserId: null }, 'player', {}, { trackedFromStart: true, stuns: 0 })[metric], undefined)
    }
})

test('mode actions cannot leak into other modes and missing telemetry grants no new objectives', () => {
    const gameplay = { flutterRingsCleared: 12, puncturePinsPlaced: 8, timberLogsChopped: 40, trackedFromStart: true, stuns: 0 }
    const flutter = metrics({ ...result, modeId: 'sat-flutter' }, 'player', {}, gameplay)
    assert.equal(flutter.flutter_ring_cleared, 12)
    assert.equal(flutter.puncture_pin_placed, undefined)
    assert.equal(flutter.timber_log_chopped, undefined)
    assert.equal(flutter.timber_clean_win, undefined)
    assert.equal(metrics({ ...result, modeId: 'sat-puncture' }, 'player', {}, gameplay).puncture_pin_placed, 8)
    assert.deepEqual(metrics(result, 'player'), { match_played: 1, 'mode:sat-timber': 1, match_won: 1 })
})

test('unranked, short, unengaged and forfeited matches produce no quest events', () => {
    for(const patch of [{ ranked: false }, { roundsPlayed: 1 }, { participationByUserId: { player: 1 } }, { endReason: 'player_left' }]) {
        assert.deepEqual(buildMatchQuestEvents({ ...result, ...patch }, 'player', { correct: 10 }), [])
    }
})

test('sanitization removes bots and cannot turn invalid stun telemetry into a clean win', () => {
    for(const stuns of [undefined, -1, NaN, Infinity, '0', 0.5]) {
        const sanitized = sanitizeRealtimeResult({ ...result, playerIds: ['player', 'bot'], botPlayerIds: ['bot'],
            gameplayByUserId: { player: { trackedFromStart: true, stuns, timberLogsChopped: 2 }, bot: { stuns: 0 } },
        })
        assert.equal(sanitized.gameplayByUserId.player.trackedFromStart, false)
        assert.deepEqual(Object.keys(sanitized.persistedResult.gameplayByUserId), ['player'])
        assert.equal(metrics(result, 'player', {}, sanitized.gameplayByUserId.player).timber_clean_win, undefined)
    }
})
