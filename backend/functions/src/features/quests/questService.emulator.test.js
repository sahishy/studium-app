import assert from 'node:assert/strict'
import test from 'node:test'
import { randomUUID } from 'node:crypto'

test('match results apply new quest metrics once and preserve clean-win requirements', { skip: process.env.USE_FIREBASE_EMULATORS !== 'true' }, async () => {
    const { db } = await import('../../lib/firebaseAdmin.js')
    const { saveRealtimeResult } = await import('../realtime/realtimeService.js')
    const userId = `quest_match_${randomUUID()}`
    const gameIds = Array.from({ length: 4 }, () => `quest_match_${randomUUID()}`)
    const boardRef = db.collection('questBoards').doc(userId)
    const userRef = db.collection('users').doc(userId)
    const cleanup = [userRef, boardRef, db.collection('userStats').doc(userId), db.collection('wallets').doc(userId),
        ...gameIds.flatMap((id) => [db.collection('gameResults').doc(id), db.collection('rewardEvents').doc(`match_${id}_${userId}`)])]
    try {
        await userRef.set({ progress: { level: 1, xp: 0, timeZone: 'America/New_York' } })
        await boardRef.set({ userId, questIds: ['timber-logs-150', 'timber-clean-wins-2', 'correct-15'], progress: {}, completed: {} })
        const match = (index, patch = {}) => ({
            gameId: gameIds[index], modeId: 'sat-timber', ranked: true, playerIds: [userId, 'bot'], botPlayerIds: ['bot'],
            winnerUserId: userId, roundsPlayed: 3, endReason: 'first_to_three', participationByUserId: { [userId]: 3 },
            startedAt: Date.now() - 120000, endedAt: Date.now(),
            performanceByUserId: { [userId]: { faced: 3, answered: 3, correct: 3, roundsWon: 3, avgAnswerMs: 10000,
                byDomain: { Algebra: { answered: 3, correct: 3 } }, byDifficulty: {} } },
            gameplayByUserId: { [userId]: { trackedFromStart: true, stuns: 0, timberLogsChopped: 45 } },
            ...patch,
        })
        const first = match(0)
        await saveRealtimeResult(first)
        const afterFirst = (await boardRef.get()).data().progress
        assert.deepEqual(afterFirst, { 'timber-logs-150': 45, 'timber-clean-wins-2': 1, 'correct-15': 3 })
        assert.equal((await saveRealtimeResult(first)).duplicate, true)
        assert.deepEqual((await boardRef.get()).data().progress, afterFirst)
        await saveRealtimeResult(match(1, { gameplayByUserId: { [userId]: { trackedFromStart: true, stuns: 1, timberLogsChopped: 40 } } }))
        assert.deepEqual((await boardRef.get()).data().progress, { 'timber-logs-150': 85, 'timber-clean-wins-2': 1, 'correct-15': 6 })
        await saveRealtimeResult(match(2, { ranked: false }))
        assert.equal((await boardRef.get()).data().progress['timber-logs-150'], 85)
        await saveRealtimeResult(match(3))
        assert.equal((await boardRef.get()).data().progress['timber-clean-wins-2'], 2)
        assert.equal((await boardRef.get()).data().completed['timber-clean-wins-2'], true)
    } finally {
        await Promise.allSettled(cleanup.map((ref) => ref.delete()))
    }
})

test('continuous quests claim rewards once under concurrent requests and preserve other slots', { skip: process.env.USE_FIREBASE_EMULATORS !== 'true' }, async () => {
    const { db } = await import('../../lib/firebaseAdmin.js')
    const { claimQuest, getQuestBoard, recordQuestEvent, rerollQuest } = await import('./questService.js')
    const userId = `quest_test_${randomUUID()}`
    const userRef = db.collection('users').doc(userId)
    const boardRef = db.collection('questBoards').doc(userId)
    const walletRef = db.collection('wallets').doc(userId)
    try {
        await userRef.set({ progress: { level: 1, xp: 0, timeZone: 'America/New_York' } })
        await boardRef.set({ userId, questIds: ['tasks-12', 'win-1', 'hearts-1'], progress: { 'win-1': 0 }, completed: {}, rerollDay: '2000-01-01', rerollsUsed: 1 })
        const completion = await recordQuestEvent(userId, 'task_completed', { amount: 12 })
        assert.deepEqual(completion.reward, { xp: 0, lumen: 0, crates: 0 })
        assert.equal(completion.wallet.balance, 0)
        assert.equal(completion.progress.xp, 0)
        const board = await getQuestBoard(userId)
        assert.equal(board.rerollsRemaining, 1, 'only rerolls reset at midnight')
        const quest = board.quests[0]
        assert.equal(quest.completed, true)
        const results = await Promise.allSettled([
            claimQuest(userId, quest.id, quest.instanceId),
            claimQuest(userId, quest.id, quest.instanceId),
        ])
        assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
        const payout = results.find((result) => result.status === 'fulfilled').value
        assert.deepEqual(payout.reward, { xp: 80, lumen: 40, crates: 2 })
        assert.equal((await walletRef.get()).data().balance, 40)
        assert.equal((await walletRef.get()).data().crateTokens, 2)
        const next = await getQuestBoard(userId)
        assert.notEqual(next.quests[0].instanceId, quest.instanceId)
        assert.equal(next.quests[0].current, 0)
        assert.equal(next.quests[0].completed, false)
        assert.deepEqual(next.quests.slice(1), board.quests.slice(1))
        const rerolled = await rerollQuest(userId, next.quests[1].id)
        assert.equal(rerolled.rerollsRemaining, 0)
        await assert.rejects(() => rerollQuest(userId, rerolled.quests[1].id), /No rerolls/)
        assert.equal((await getQuestBoard(userId)).rerollsRemaining, 0)
    } finally {
        await Promise.all([userRef, boardRef, walletRef].map((ref) => ref.delete()))
    }
})

test('migration keeps unfinished daily work and does not pay previously rewarded completions twice', { skip: process.env.USE_FIREBASE_EMULATORS !== 'true' }, async () => {
    const { db } = await import('../../lib/firebaseAdmin.js')
    const { localDayKey } = await import('../economy/progression.js')
    const { claimQuest, getQuestBoard } = await import('./questService.js')
    const userId = `quest_migration_${randomUUID()}`
    const userRef = db.collection('users').doc(userId)
    const legacyRef = db.collection('questDays').doc(`${userId}_${localDayKey(new Date(), 'America/New_York')}`)
    const boardRef = db.collection('questBoards').doc(userId)
    try {
        await userRef.set({ progress: { level: 1, xp: 0, timeZone: 'America/New_York' } })
        await legacyRef.set({ questIds: ['tasks-3', 'win-1', 'hearts-1'], progress: { 'tasks-3': 2, 'hearts-1': 1 }, completed: { 'hearts-1': true }, rerollsUsed: 1 })
        const board = await getQuestBoard(userId)
        assert.equal(board.quests[0].current, 2)
        assert.equal(board.quests[2].current, 0)
        assert.equal(board.quests[2].completed, false)
        assert.equal(board.rerollsRemaining, 0)
        await assert.rejects(() => claimQuest(userId, 'hearts-1', 'hearts-1:0'), /already been replaced/)
        await assert.rejects(() => claimQuest(userId, 'hearts-1', 'hearts-1:1'), /Finish/)
        assert.deepEqual((await getQuestBoard(userId)).quests, board.quests)
    } finally {
        await Promise.all([userRef, legacyRef, boardRef].map((ref) => ref.delete()))
    }
})
