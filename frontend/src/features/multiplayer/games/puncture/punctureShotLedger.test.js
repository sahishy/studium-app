import assert from 'node:assert/strict'
import test from 'node:test'
import {
    appendPendingShot,
    applyShotOverlay,
    getPlaybackView,
    getUnconfirmedShots,
    mergeShotEvents,
    predictionAngles,
    pruneConfirmedShots,
    recalculatePendingShots,
    reconcileActionResult,
    shotKey,
} from './punctureShotLedger.js'

const shot = (id, overrides = {}) => ({
    sequence: null,
    roundIndex: 2,
    clientActionId: id,
    shotAt: 1_000,
    impactAt: 1_075,
    hit: false,
    attachedAngle: 45,
    targetAngle: 45,
    ...overrides,
})

test('rapid pending shots stay ordered and prediction includes earlier unresolved pins', () => {
    let ledger = appendPendingShot([], shot('one', { attachedAngle: 40 }), 10)
    ledger = appendPendingShot(ledger, shot('two', { shotAt: 1_050, attachedAngle: 80 }), 20)
    assert.deepEqual(ledger.map((entry) => entry.id), ['one', 'two'])
    assert.deepEqual(predictionAngles([10], getUnconfirmedShots(ledger)), [10, 40, 80])
})

test('out-of-order receipts update their matching shot without removing neighbors', () => {
    let ledger = appendPendingShot([], shot('one'), 10)
    ledger = appendPendingShot(ledger, shot('two', { shotAt: 1_050 }), 20)
    const authoritative = shot('two', { sequence: 2, hit: true, attachedAngle: null, targetAngle: 92 })
    ledger = reconcileActionResult(ledger, { action: 'game.shoot', clientActionId: 'two', accepted: true, shot: authoritative })
    assert.equal(ledger[0].status, 'pending')
    assert.equal(ledger[1].status, 'accepted')
    assert.deepEqual(ledger[1].shot, authoritative)
})

test('an authoritative correction re-predicts every later pending shot in order', () => {
    let ledger = appendPendingShot([], shot('one', { attachedAngle: 40, targetAngle: 40 }), 10)
    ledger = appendPendingShot(ledger, shot('two', { shotAt: 1_050, attachedAngle: 80, targetAngle: 80 }), 20)
    ledger = reconcileActionResult(ledger, {
        action: 'game.shoot',
        clientActionId: 'one',
        accepted: true,
        shot: shot('one', { sequence: 1, attachedAngle: 90, targetAngle: 90 }),
    })
    ledger = recalculatePendingShots(ledger, {
        roundStartedAt: 0,
        rotationTurnsPerSecond: 0,
        generatedPinAngles: [],
        attachedPinAngles: [],
    })
    assert.equal(ledger[1].shot.hit, true)
    assert.equal(ledger[1].shot.attachedAngle, null)
    assert.equal(ledger[1].shot.targetAngle, 90)
})

test('a rejected receipt rolls back only that prediction', () => {
    let ledger = appendPendingShot([], shot('one'), 10)
    ledger = appendPendingShot(ledger, shot('two'), 20)
    ledger = reconcileActionResult(ledger, { action: 'game.shoot', clientActionId: 'one', accepted: false, reason: 'rate_limited' })
    assert.deepEqual(ledger.map((entry) => entry.id), ['two'])
})

test('authoritative recent shots prune the ledger and override duplicate predictions in playback', () => {
    let ledger = appendPendingShot([], shot('one', { targetAngle: 41 }), 10)
    ledger = appendPendingShot(ledger, shot('two'), 20)
    const confirmed = shot('one', { sequence: 1, targetAngle: 42 })
    assert.deepEqual(pruneConfirmedShots(ledger, [confirmed]).map((entry) => entry.id), ['two'])
    assert.deepEqual(mergeShotEvents(ledger.map((entry) => entry.shot), [confirmed]).map((entry) => entry.targetAngle), [42, 45])
})

test('optimistic overlay applies every unresolved miss and predicted stun', () => {
    const player = { state: { pinsRemaining: 10, puncturePinAngles: [5], stunnedUntil: 0 } }
    const result = applyShotOverlay(player, [
        shot('one', { attachedAngle: 40 }),
        shot('two', { shotAt: 1_050, hit: true, attachedAngle: null, targetAngle: 5 }),
        shot('three', { shotAt: 1_100, attachedAngle: 80 }),
    ])
    assert.equal(result.state.pinsRemaining, 8)
    assert.deepEqual(result.state.puncturePinAngles, [5, 40, 80])
    assert.equal(result.state.stunnedUntil, 3_050)
})

test('playback view reveals misses sequentially and temporarily removes a collision pin', () => {
    const finalAngles = [10, 20, 30]
    const duringMiss = getPlaybackView({
        pinsRemaining: 7,
        attachedPinAngles: finalAngles,
        queuedShots: [shot('later', { attachedAngle: 30 })],
        activeShot: shot('active', { attachedAngle: 20 }),
    })
    assert.equal(duringMiss.displayPinsRemaining, 8)
    assert.deepEqual(duringMiss.visibleAttachedPinAngles, [10])

    const duringHit = getPlaybackView({
        pinsRemaining: 9,
        attachedPinAngles: [10],
        activeShot: shot('hit', { hit: true, attachedAngle: null, targetAngle: 10 }),
    })
    assert.equal(duringHit.displayPinsRemaining, 8)
    assert.deepEqual(duringHit.visibleAttachedPinAngles, [10])
})

test('server-only shots receive stable sequence keys', () => {
    assert.equal(shotKey({ roundIndex: 4, sequence: 7, clientActionId: null }), 'server:4:7')
})
