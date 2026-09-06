import assert from 'node:assert/strict'
import test from 'node:test'
import { activePendingChops, generateBranchSequence, predictChop, VISIBLE_BRANCHES } from './timberPrediction.js'

// The predicted chop count drives which slice of the branch sequence the tree draws, and
// TimberScene keys each branch on its absolute index. So any moment where that count is wrong -
// even for a single frame - unmounts and remounts branch rows, which the player sees as jitter.
// These cover the ordering that used to produce exactly that.

const chop = (clientActionId, side = 'left') => ({ clientActionId, side, sentAt: 0, actualChops: null })
const acknowledge = (chops, clientActionId, actualChops) => chops.map((entry) => (
    entry.clientActionId === clientActionId ? { ...entry, actualChops } : entry
))
const predictedCount = (serverActualChops, pending) => serverActualChops + activePendingChops(pending, serverActualChops).length

test('an acknowledged chop stops being predicted the moment its count arrives', () => {
    const pending = acknowledge([chop('a')], 'a', 11)

    // The acknowledgement travels ahead of the coalesced snapshot, so for a while the server's
    // published count is still behind and the chop must keep being predicted.
    assert.equal(predictedCount(10, pending), 11)
    // The snapshot lands. The chop is now in the server's own count and must not be added again.
    assert.equal(predictedCount(11, pending), 11)
})

test('the predicted count never overshoots as a burst of chops is confirmed one by one', () => {
    let serverActualChops = 0
    let pending = []
    const counts = []

    for(let index = 0; index < 12; index += 1) {
        const id = `chop-${index}`
        pending = [...pending, chop(id)]
        counts.push(predictedCount(serverActualChops, pending))

        // Acknowledgement first, then the snapshot that carries the same count - the real order,
        // and the one that used to leave a frame of overshoot between them.
        pending = acknowledge(pending, id, serverActualChops + activePendingChops(pending, serverActualChops).length)
        counts.push(predictedCount(serverActualChops, pending))
        serverActualChops += 1
        counts.push(predictedCount(serverActualChops, pending))
    }

    // Every observation is a chop count the player actually made: never above the number pressed,
    // and never moving backwards.
    counts.forEach((count, index) => {
        assert.ok(count <= Math.ceil((index + 1) / 3), `overshoot at step ${index}: ${count}`)
        if(index > 0) assert.ok(count >= counts[index - 1], `went backwards at step ${index}`)
    })
    assert.equal(predictedCount(serverActualChops, pending), 12)
})

test('a rejected chop leaves the queue as soon as it is removed, without disturbing the rest', () => {
    // Rejections are removed by clientActionId rather than by position, so the survivors keep
    // their alignment with the branch sequence.
    const pending = [chop('a'), chop('b'), chop('c')]
    const afterRejection = pending.filter((entry) => entry.clientActionId !== 'b')
    assert.deepEqual(activePendingChops(afterRejection, 0).map((entry) => entry.clientActionId), ['a', 'c'])
    assert.equal(predictedCount(0, afterRejection), 2)
})

test('the branch a chop is predicted against follows the predicted count exactly', () => {
    const sequence = generateBranchSequence(12345)
    const serverActualChops = 7
    const pending = [chop('a'), chop('b')]
    const remaining = sequence.slice(serverActualChops)
    const active = activePendingChops(pending, serverActualChops)

    // The next chop is predicted at `active.length` into what is left, which must be the same row
    // the tree is about to draw at its base.
    const drawn = remaining.slice(active.length, active.length + VISIBLE_BRANCHES)
    assert.equal(drawn[0], sequence[serverActualChops + active.length])
    assert.equal(
        predictChop({ branches: remaining, index: active.length, side: 'left' }).hit,
        sequence[serverActualChops + active.length] === 'left',
    )
})
