import assert from 'node:assert/strict'
import test from 'node:test'
import { describeMastery, foldMastery } from './masteryService.js'

test('new players have a neutral skill shape without fictitious answers', () => {
    const domains = describeMastery()
    assert.equal(domains.length, 8)
    assert.ok(domains.every((domain) => domain.accuracy === 0.5 && domain.answered === 0 && domain.correct === 0))
})

test('early performance nudges the baseline rather than jumping to an extreme', () => {
    const domains = describeMastery(foldMastery({}, {
        Algebra: { answered: 1, correct: 1 },
        'Advanced Math': { answered: 1, correct: 0 },
    }))
    assert.ok(domains.find((d) => d.id === 'Algebra').accuracy > 0.5)
    assert.ok(domains.find((d) => d.id === 'Algebra').accuracy < 0.65)
    assert.ok(domains.find((d) => d.id === 'Advanced Math').accuracy < 0.5)
    assert.ok(domains.find((d) => d.id === 'Advanced Math').accuracy > 0.35)
    assert.equal(domains.find((d) => d.id === 'Craft and Structure').accuracy, 0.5)
})

test('match comparison preserves the original board while changed domains move on the new board', async () => {
    const { describeMasteryBoard } = await import('./masteryService.js')
    const stored = { Algebra: { answered: 10, correct: 5, accuracyEwma: 0.5 } }
    const before = describeMasteryBoard(stored)
    const after = describeMasteryBoard(foldMastery(stored, { Algebra: { answered: 2, correct: 2 } }))
    assert.equal(before.domains.find((domain) => domain.id === 'Algebra').accuracy, 0.5)
    assert.ok(Math.abs(after.domains.find((domain) => domain.id === 'Algebra').accuracy - 0.65) < 1e-10)
    assert.equal(before.answered, 10)
    assert.equal(after.answered, 12)
    assert.equal(stored.Algebra.answered, 10)
    assert.deepEqual(before.domains.filter((domain) => domain.id !== 'Algebra'), after.domains.filter((domain) => domain.id !== 'Algebra'))
})

test('match mastery returns only the caller comparison and rejects unrelated users', async (t) => {
    const { db } = await import('../../lib/firebaseAdmin.js')
    const { getMatchMastery } = await import('./masteryService.js')
    const ownComparison = { before: { answered: 0 }, after: { answered: 2 } }
    t.mock.method(db, 'collection', (name) => {
        assert.equal(name, 'gameResults')
        return { doc: () => ({ get: async () => ({ exists: true, data: () => ({
            playerIds: ['me', 'opponent'], masteryByUserId: { me: ownComparison, opponent: { private: true } },
        }) }) }) }
    })
    assert.deepEqual(await getMatchMastery('me', 'match'), { pending: false, comparison: ownComparison })
    await assert.rejects(getMatchMastery('stranger', 'match'), /Unauthorized/)
})

test('uncommitted matches wait for settlement and old results have no invented comparison', async (t) => {
    const { db } = await import('../../lib/firebaseAdmin.js')
    const { getMatchMastery } = await import('./masteryService.js')
    t.mock.method(db, 'collection', () => ({ doc: (id) => ({ get: async () => ({
        exists: id !== 'pending', data: () => ({ playerIds: ['me'] }),
    }) }) }))
    assert.deepEqual(await getMatchMastery('me', 'pending'), { pending: true })
    assert.deepEqual(await getMatchMastery('me', 'old-match'), { pending: false, comparison: null })
})
