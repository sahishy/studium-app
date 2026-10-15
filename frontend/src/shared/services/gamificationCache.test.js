import assert from 'node:assert/strict'
import test, { before, after, beforeEach } from 'node:test'
import { createServer } from 'vite'

let server, cache, store
before(async () => {
    server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
    cache = await server.ssrLoadModule('/src/shared/services/gamificationCache.js')
    store = await server.ssrLoadModule('/src/shared/services/cacheService.jsx')
})
after(async () => { await server?.close() })
beforeEach(() => { cache.clearGamificationCache() })

const economy = balance => ({ wallet: { balance }, progress: { level: 1 }, catalog: [] })
const read = (fetchData, options = {}) => cache.readGamificationCache({ userId: 'alice', path: '/v1/economy', fetchData, ...options })
const deferred = () => {
    let resolve
    const promise = new Promise(done => { resolve = done })
    return { promise, resolve }
}

test('repeated visits and concurrent consumers reuse one backend read', async () => {
    let reads = 0
    const fetchData = async () => { reads++; return economy(10) }
    await Promise.all([read(fetchData), read(fetchData)])
    await read(fetchData)
    assert.equal(reads, 1)
})

test('expired entries and explicit refreshes reach the backend', async () => {
    let reads = 0
    const fetchData = async () => economy(++reads)
    await read(fetchData)
    const key = store.createCacheKey('gamification', 'alice:') + '/v1/economy'
    store.getCacheEntry(key).expiresAt = 0
    assert.equal((await read(fetchData)).wallet.balance, 2)
    assert.equal((await read(fetchData, { fresh: true })).wallet.balance, 3)
})

test('accounts, time zones and match IDs have separate cache entries', async () => {
    let reads = 0
    const fetchData = async () => { reads++; return { ...economy(10), dayKey: '2026-10-15', week: [], comparison: {} } }
    for(const options of [
        {}, { userId: 'bob' },
        { path: '/v1/streak?timeZone=UTC' }, { path: '/v1/streak?timeZone=America%2FNew_York' },
        { path: '/v1/mastery/matches/one' }, { path: '/v1/mastery/matches/two' },
    ]) {
        await read(fetchData, options)
        await read(fetchData, options)
    }
    assert.equal(reads, 6)
})

test('failed, incomplete and pending responses are retried rather than cached', async () => {
    await assert.rejects(read(async () => { throw new Error('offline') }))
    for(const value of [{}, { wallet: {} }]) await read(async () => value)
    let reads = 0
    const fetchData = async () => { reads++; return { pending: true } }
    await read(fetchData, { path: '/v1/mastery/matches/one' })
    await read(fetchData, { path: '/v1/mastery/matches/one' })
    assert.equal(reads, 2)
    assert.equal((await read(async () => economy(25))).wallet.balance, 25)
})

test('mutation invalidation detaches an older request and preserves the new balance', async () => {
    const old = deferred()
    const first = read(() => old.promise)
    cache.invalidateGamificationMutation('alice', '/v1/economy/crates/open')
    await read(async () => economy(20))
    old.resolve(economy(100))
    await first
    assert.equal((await read(() => assert.fail('should be cached'))).wallet.balance, 20)
})

test('forced reads supersede in-flight reads without letting old results refill the cache', async () => {
    const old = deferred()
    const first = read(() => old.promise)
    await read(async () => economy(30), { fresh: true })
    old.resolve(economy(100))
    await first
    assert.equal((await read(() => assert.fail('should be cached'))).wallet.balance, 30)
})

test('sign-out clears values and prevents pending responses from restoring them', async () => {
    const old = deferred()
    const first = read(() => old.promise)
    cache.clearGamificationCache()
    old.resolve(economy(100))
    await first
    assert.equal((await read(async () => economy(0))).wallet.balance, 0)
})

test('quest, streak, content, task and circle rewards invalidate cached gamification reads', async () => {
    for(const path of ['/v1/quests/claim', '/v1/quests/reroll', '/v1/streak/claim', '/v1/tasks/task/status', '/v1/resources', '/v1/college-posts', '/v1/circles/circle/grand-quest/claim', '/v1/dev/reset']) {
        await read(async () => economy(100))
        cache.invalidateGamificationMutation('alice', path)
        assert.equal((await read(async () => economy(20))).wallet.balance, 20, path)
        cache.clearGamificationCache()
    }
})

test('unrelated routes and quest boards keep their existing loading behavior', async () => {
    let reads = 0
    const fetchData = async () => { reads++; return { quests: [] } }
    await read(fetchData, { path: '/v1/quests?timeZone=UTC' })
    await read(fetchData, { path: '/v1/quests?timeZone=UTC' })
    assert.equal(reads, 2)
})


test('mastery boards reuse empty and populated skill histories', async () => {
    for(const domains of [[], [{ id: 'Algebra', answered: 5 }]]) {
        cache.clearGamificationCache()
        const board = { domains }
        await read(async () => board, { path: '/v1/mastery' })
        assert.deepEqual(await read(() => assert.fail('should be cached'), { path: '/v1/mastery' }), board)
    }
})

test('a streak visit after local midnight bypasses yesterday even before TTL expiry', async (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: new Date(2026, 9, 15, 23, 59, 59).getTime() })
    const options = { path: '/v1/streak?timeZone=America%2FNew_York' }
    await read(async () => ({ dayKey: '2026-10-15', week: [] }), options)
    t.mock.timers.tick(2000)
    const board = await read(async () => ({ dayKey: '2026-10-16', week: [] }), options)
    assert.equal(board.dayKey, '2026-10-16')
})
