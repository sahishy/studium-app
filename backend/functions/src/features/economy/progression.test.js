import assert from 'node:assert/strict'
import test from 'node:test'
import { MAX_LEVEL_XP, claimableLevels, earnedMilestoneCrates, eligibleMatchReward, grantXp, levelReward, localDayKey, normalizeProgress, xpToNextLevel } from './progression.js'
import { chooseColor, RARITY_ODDS } from './economyService.js'

test('the level curve flattens out so late levels stay reachable', () => {
    assert.equal(xpToNextLevel(1), 150)
    assert.equal(xpToNextLevel(5), 230)
    assert.equal(xpToNextLevel(50), MAX_LEVEL_XP)
    assert.ok(xpToNextLevel(30) <= MAX_LEVEL_XP, 'the curve never exceeds its cap')
    assert.equal(earnedMilestoneCrates(1), 0)
    assert.equal(earnedMilestoneCrates(10), 3)
    assert.equal(earnedMilestoneCrates(20), 5)
})

test('migrating a curve keeps the level and proportional progress', () => {
    // Half way through level 5 on the old linear curve stays half way on the new one.
    const migrated = normalizeProgress({ level: 5, xp: 200, curveVersion: 2 })
    assert.equal(migrated.level, 5)
    assert.equal(migrated.curveVersion, 3)
    assert.equal(migrated.xp, Math.floor(0.5 * xpToNextLevel(5)))

    // The original exponential curve migrates without losing a level either.
    const legacy = normalizeProgress({ level: 5, xp: 1600 })
    assert.equal(legacy.level, 5)
    assert.ok(legacy.xp < xpToNextLevel(5))
})

test('levelling up carries the remainder into the next level', () => {
    const result = grantXp({ level: 1, xp: 140, curveVersion: 3 }, 20)
    assert.deepEqual({ level: result.level, xp: result.xp }, { level: 2, xp: 10 })
})

test('every level past the first pays out, and only once', () => {
    assert.deepEqual(levelReward(2), { level: 2, type: 'crate', crates: 1, lumen: 0 })
    assert.deepEqual(levelReward(3), { level: 3, type: 'lumen', crates: 0, lumen: 25 })
    assert.equal(levelReward(10).type, 'crate')
    assert.equal(levelReward(15).type, 'crate')

    const pending = claimableLevels(5, [2, 3])
    assert.deepEqual(pending.map((entry) => entry.level), [4, 5])
    assert.deepEqual(claimableLevels(1, []), [])
    assert.deepEqual(claimableLevels(5, [2, 3, 4, 5]), [])
})

test('daily key uses the saved timezone', () => {
    const moment = new Date('2026-10-05T01:00:00.000Z')
    assert.notEqual(localDayKey(moment, 'America/New_York'), localDayKey(moment, 'UTC'))
})

test('ranked rewards require completion and real participation, including bot games', () => {
    const result = { ranked: true, modeId: 'sat-classic', endReason: 'max_questions', roundsPlayed: 3, participationByUserId: { student: 2 }, winnerUserId: 'student', botPlayerIds: ['bot'] }
    assert.deepEqual(eligibleMatchReward(result, 'student'), { xp: 35, lumen: 15 })
    assert.deepEqual(eligibleMatchReward({ ...result, winnerUserId: 'bot' }, 'student'), { xp: 25, lumen: 10 })
    assert.deepEqual(eligibleMatchReward({ ...result, participationByUserId: { student: 1 } }, 'student'), { xp: 0, lumen: 0 })
    assert.deepEqual(eligibleMatchReward({ ...result, endReason: 'player_left' }, 'student'), { xp: 0, lumen: 0 })
})

test('color crate rarity thresholds match published odds', () => {
    assert.deepEqual(RARITY_ODDS, { Common: 60, Uncommon: 25, Rare: 11, Epic: 3, Legendary: 1 })
    assert.equal(Object.values(RARITY_ODDS).reduce((total, value) => total + value, 0), 100)

    const colorAt = (roll) => chooseColor((max) => max === 100 ? roll : 0)
    assert.equal(colorAt(0).rarity, 'Common')
    assert.equal(colorAt(59).rarity, 'Common')
    assert.equal(colorAt(60).rarity, 'Uncommon')
    assert.equal(colorAt(85).rarity, 'Rare')
    assert.equal(colorAt(96).rarity, 'Epic')
    assert.equal(colorAt(99).rarity, 'Legendary')
})

const rankedResult = (overrides = {}) => ({
    ranked: true, modeId: 'sat-classic', endReason: 'max_questions', roundsPlayed: 10,
    participationByUserId: { me: 10, rival: 10 }, winnerUserId: 'me', ...overrides,
})

const perf = (overrides = {}) => ({
    faced: 10, answered: 10, correct: 5, roundsWon: 5, avgAnswerMs: 25_000,
    byDomain: {}, byDifficulty: {}, ...overrides,
})

test('a match with no telemetry still pays the flat rate', () => {
    const reward = eligibleMatchReward(rankedResult({ winnerUserId: null }), 'me')
    assert.deepEqual(reward, { xp: 25, lumen: 10 })
})

test('answering well out-earns winning badly', () => {
    const strongLoss = eligibleMatchReward(rankedResult({ winnerUserId: 'rival' }), 'me', {
        performance: perf({ correct: 9, roundsWon: 4 }),
    })
    const weakWin = eligibleMatchReward(rankedResult(), 'me', {
        performance: perf({ correct: 2, roundsWon: 6, avgAnswerMs: 85_000 }),
    })
    assert.ok(
        strongLoss.xp > weakWin.xp,
        `a 9/10 loss (${strongLoss.xp} xp) should beat a 2/10 win (${weakWin.xp} xp)`,
    )
})

test('unanswered questions count against accuracy, so stalling cannot farm a ratio', () => {
    const answeredEverything = eligibleMatchReward(rankedResult(), 'me', { performance: perf({ correct: 8 }) })
    const answeredOnlyTheEasyOnes = eligibleMatchReward(rankedResult(), 'me', {
        performance: perf({ answered: 2, correct: 2 }),
    })
    assert.ok(answeredEverything.xp > answeredOnlyTheEasyOnes.xp)
})

test('beating a higher-rated opponent pays a premium, losing to one costs nothing extra', () => {
    const evenWin = eligibleMatchReward(rankedResult(), 'me', { performance: perf(), selfElo: 500, opponentElo: 500 })
    const underdogWin = eligibleMatchReward(rankedResult(), 'me', { performance: perf(), selfElo: 500, opponentElo: 900 })
    assert.ok(underdogWin.xp > evenWin.xp)

    const evenLoss = eligibleMatchReward(rankedResult({ winnerUserId: 'rival' }), 'me', { performance: perf(), selfElo: 500, opponentElo: 500 })
    const underdogLoss = eligibleMatchReward(rankedResult({ winnerUserId: 'rival' }), 'me', { performance: perf(), selfElo: 500, opponentElo: 900 })
    assert.deepEqual(underdogLoss, evenLoss)
})

test('rewards taper after a long session but never reach zero', () => {
    const context = { performance: perf() }
    const fresh = eligibleMatchReward(rankedResult(), 'me', { ...context, priorRewardedMatchesToday: 0 })
    const eighth = eligibleMatchReward(rankedResult(), 'me', { ...context, priorRewardedMatchesToday: 8 })
    const twentieth = eligibleMatchReward(rankedResult(), 'me', { ...context, priorRewardedMatchesToday: 20 })

    assert.ok(fresh.xp > eighth.xp && eighth.xp > twentieth.xp)
    assert.ok(twentieth.xp >= 1 && twentieth.lumen >= 1, 'an eligible match always counts')
})

test('an ineligible match pays nothing however well it was played', () => {
    const forfeit = eligibleMatchReward(rankedResult({ endReason: 'player_left' }), 'me', { performance: perf({ correct: 10 }) })
    assert.deepEqual(forfeit, { xp: 0, lumen: 0 })
})
