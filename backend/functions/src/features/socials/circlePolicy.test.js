import test from 'node:test'
import assert from 'node:assert/strict'
import { grandQuestRound, grandQuestState, eligibleGrandQuestRound } from './circlePolicy.js'

test('random goals and difficulty-scaled rewards stay stable across retries', () => {
    const targets = new Set(), xpRewards = new Set(), lumenRewards = new Set()
    for (let cycle = 1; cycle <= 1000; cycle++) {
        const round = grandQuestRound('circle', cycle)
        assert.deepEqual(round, grandQuestRound('circle', cycle))
        assert.ok(round.target >= 50 && round.target <= 100)
        assert.ok(round.reward.xp >= 150 && round.reward.xp <= 400)
        assert.ok(round.reward.lumen >= 100 && round.reward.lumen <= 300)
        assert.ok(Math.abs(round.reward.xp - (150 + (round.target - 50) * 5)) <= 20)
        assert.ok(Math.abs(round.reward.lumen - (100 + (round.target - 50) * 4)) <= 15)
        xpRewards.add(round.reward.xp)
        lumenRewards.add(round.reward.lumen)
        targets.add(round.target)
    }
    assert.equal(targets.size, 51)
    assert.equal(Math.min(...xpRewards), 150)
    assert.equal(Math.max(...xpRewards), 400)
    assert.equal(Math.min(...lumenRewards), 100)
    assert.equal(Math.max(...lumenRewards), 300)
})
test('migration retains unfinished progress and avoids reusing completed cycle IDs', () => {
    const state = grandQuestState('circle', { count: 27 })
    assert.equal(state.count, 27)
    assert.equal(state.cycle, 3)
    assert.equal(state.roundProgress, 7)
    assert.deepEqual(grandQuestState('circle', state), state)
    assert.equal(grandQuestState('new').roundProgress, 0)
})
test('claims fail closed for legacy rounds without primary-at-completion evidence', () => {
    assert.equal(eligibleGrandQuestRound({ eligible: ['user'] }, 'user'), false)
    assert.equal(eligibleGrandQuestRound({ version: 2, eligible: ['user'] }, 'user'), true)
    assert.equal(Boolean(eligibleGrandQuestRound({ version: 2, eligible: [] }, 'user')), false)
})
