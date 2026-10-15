import assert from 'node:assert/strict'
import test from 'node:test'
import { createGrandQuestClaimGuard } from './grandQuestClaimGuard.js'

test('rapid clicks cannot submit twice before React disables the button, and a stale board cannot resubmit', async () => {
    const guard = createGrandQuestClaimGuard()
    let resolveRequest
    const response = new Promise(resolve => { resolveRequest = resolve })
    let requests = 0, celebrations = 0
    const claim = async key => {
        if (!guard.start(key)) return
        try {
            requests++
            await response
            guard.markClaimed(key)
            celebrations++
        } finally { guard.finish() }
    }
    const clicks = Array.from({ length: 20 }, () => claim('circle-a:round-1'))
    assert.equal(requests, 1)
    resolveRequest()
    await Promise.all(clicks)
    await claim('circle-a:round-1')
    assert.equal(requests, 1, 'an old polling response cannot enable a second request for the same round')
    assert.equal(celebrations, 1)
    await claim('circle-a:round-2')
    assert.equal(requests, 2, 'a newly completed round can still be claimed')
})

test('failed requests unlock retry without treating the round as claimed', async () => {
    const guard = createGrandQuestClaimGuard()
    assert.equal(guard.start('circle-a:round-1'), true)
    try { await Promise.reject(new Error('Network unavailable')) }
    catch { /* No successful claim was recorded. */ }
    finally { guard.finish() }
    assert.equal(guard.hasClaimed('circle-a:round-1'), false)
    assert.equal(guard.start('circle-a:round-1'), true)
    assert.equal(guard.start('circle-b:round-1'), false, 'a pending claim also blocks an overlapping claim after navigation')
    guard.finish()
})
