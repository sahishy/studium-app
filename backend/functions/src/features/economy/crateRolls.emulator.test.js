import assert from 'node:assert/strict'
import test from 'node:test'
import { randomUUID } from 'node:crypto'
import { CRATE_RARITIES } from './crateRolls.js'

test('local emulator: purchase grants the reward once before its four stepwise reveals', {
    skip: process.env.USE_FIREBASE_EMULATORS !== 'true',
}, async () => {
    const { db } = await import('../../lib/firebaseAdmin.js')
    const { openCrate, COSMETIC_CATALOG } = await import('./economyService.js')
    const userId = `codex_crate_${randomUUID()}`
    const op = `test_${randomUUID()}`
    const user = db.collection('users').doc(userId)
    const wallet = db.collection('wallets').doc(userId)
    const operation = db.collection('economyOps').doc(`${userId}_crate_${op}`)
    const paidOp = `paid_${randomUUID()}`
    const paidOperation = db.collection('economyOps').doc(`${userId}_crate_${paidOp}`)
    try {
        await user.set({ progress: { level: 1, xp: 0 } })
        await wallet.set({ balance: 100, crateTokens: 1, inventory: [] })
        const first = await openCrate(userId, op)
        assert.equal(first.rarityPath.length, 4)
        assert.equal(first.rarityPath.at(-1), first.color.rarity)
        first.rarityPath.forEach((rarity, index) => {
            assert.ok(CRATE_RARITIES.includes(rarity))
            const before = index === 0 ? 0 : CRATE_RARITIES.indexOf(first.rarityPath[index - 1])
            const change = CRATE_RARITIES.indexOf(rarity) - before
            assert.ok(change === 0 || change === 1)
        })
        assert.ok(COSMETIC_CATALOG.some((item) => item.id === first.color.id))
        assert.equal(first.wallet.crateTokens, 0)
        assert.equal(first.wallet.balance, 100)
        assert.deepEqual(first.wallet.inventory, [first.color.id])
        assert.deepEqual(await openCrate(userId, op), first)
        const saved = (await wallet.get()).data()
        assert.equal(saved.balance, 100)
        assert.equal(saved.crateTokens, 0)
        assert.deepEqual(saved.inventory, [first.color.id])
        await wallet.set({ balance: 100, crateTokens: 0, inventory: [] })
        const paid = await openCrate(userId, paidOp)
        assert.equal(paid.wallet.balance, 0, 'A paid crate charges its price exactly once')
        assert.equal(paid.rarityPath.at(-1), paid.color.rarity)
        assert.deepEqual(await openCrate(userId, paidOp), paid)
        assert.equal((await wallet.get()).data().balance, 0)
    } finally {
        // Only this test's uniquely named, synthetic documents are removed.
        await Promise.all([user.delete(), wallet.delete(), operation.delete(), paidOperation.delete()])
    }
})
