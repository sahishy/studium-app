import assert from 'node:assert/strict'
import test from 'node:test'
import { createArrivalState, nextArrivalState } from './arrivalValue.js'

// Walks a hand-over the way RewardFxContext does: one pass when the icons take
// off, one per icon landing. `serverAt` lets a test decide which pass the wallet
// refresh lands on, which is the whole point of these cases.
const handOver = ({ start, amount, particles, serverBefore, serverAfter, serverAt }) => {
    let state = createArrivalState({ display: start, serverValue: serverBefore })
    const seen = []
    const base = Math.floor(amount / particles)
    const remainder = amount % particles

    let credited = 0
    let pending = amount

    for(let pass = 0; pass <= particles; pass += 1) {
        if(pass > 0) {
            const landing = base + (pass <= remainder ? 1 : 0)
            credited += landing
            pending -= landing
        }
        state = nextArrivalState(state, {
            serverValue: pass >= serverAt ? serverAfter : serverBefore,
            pending,
            credited,
        })
        seen.push(state.display)
    }

    return { state, seen }
}

test('a reward whose wallet refresh already landed climbs from the pre-reward value to the new balance', () => {
    // openCrate/claimLevel/tip all await refresh() before celebrating, so the
    // server value already includes the reward on the very first pass.
    const { state, seen } = handOver({
        start: 100, amount: 25, particles: 5, serverBefore: 125, serverAfter: 125, serverAt: 0,
    })

    assert.equal(seen[0], 100, 'does not jump to the new balance before the icons fly')
    assert.deepEqual(seen, [100, 105, 110, 115, 120, 125])
    assert.equal(state.display, 125)
})

test('a reward whose wallet refresh is still in flight climbs anyway and is not pulled back', () => {
    // A match reward fires refresh() alongside the animation. This is the case
    // that used to animate and then snap back to the pre-reward balance.
    const { state, seen } = handOver({
        start: 100, amount: 60, particles: 6, serverBefore: 100, serverAfter: 160, serverAt: 99,
    })

    assert.deepEqual(seen, [100, 110, 120, 130, 140, 150, 160])
    assert.equal(state.display, 160, 'the landed total survives a server value that has not caught up')
})

test('a refresh that lands mid-animation does not double-count or skip ahead', () => {
    const { state, seen } = handOver({
        start: 100, amount: 60, particles: 6, serverBefore: 100, serverAfter: 160, serverAt: 3,
    })

    assert.deepEqual(seen, [100, 110, 120, 130, 140, 150, 160])
    assert.equal(state.display, 160)
})

test('the balance is still the truth once the animation is over', () => {
    let state = createArrivalState({ display: 100, serverValue: 100 })
    state = nextArrivalState(state, { serverValue: 100, pending: 25, credited: 0 })
    state = nextArrivalState(state, { serverValue: 125, pending: 0, credited: 25 })
    assert.equal(state.display, 125)

    // Spending drops the counter straight away - no animation carries a debit.
    state = nextArrivalState(state, { serverValue: 60, pending: 0, credited: 25 })
    assert.equal(state.display, 60)
})

test('a credit with nowhere to fly to syncs to the wallet instead of adding to it', () => {
    // RewardFxContext credits outright when a counter never registers a target.
    // Pending never rises on that path.
    let state = createArrivalState({ display: 100, serverValue: 125 })
    state = nextArrivalState(state, { serverValue: 125, pending: 0, credited: 25 })
    assert.equal(state.display, 125, 'not 150')
})

test('a counter that mounts mid-reward holds its starting value until the icons arrive', () => {
    // The crate slot mounts with startFrom set to the pre-gain count while the
    // wallet already reads the new one, then celebrates on the next frame. It
    // passes followServer=false for exactly that window.
    const gain = { followServer: false }
    let state = createArrivalState({ display: 0, serverValue: 1 })
    state = nextArrivalState(state, { serverValue: 1, pending: 0, credited: 0, ...gain })
    assert.equal(state.display, 0, 'does not jump to the new count before the icon flies')

    state = nextArrivalState(state, { serverValue: 1, pending: 1, credited: 0, ...gain })
    assert.equal(state.display, 0)
    state = nextArrivalState(state, { serverValue: 1, pending: 0, credited: 1, ...gain })
    assert.equal(state.display, 1)

    // The gain window closes and the slot starts tracking the wallet again.
    state = nextArrivalState(state, { serverValue: 1, pending: 0, credited: 1 })
    assert.equal(state.display, 1)
})

test('two rewards overlapping on one counter land on the combined total', () => {
    let state = createArrivalState({ display: 100, serverValue: 100 })
    state = nextArrivalState(state, { serverValue: 100, pending: 30, credited: 0 })
    state = nextArrivalState(state, { serverValue: 130, pending: 20, credited: 10 })
    // A second reward is celebrated while the first is still arriving.
    state = nextArrivalState(state, { serverValue: 180, pending: 70, credited: 10 })
    state = nextArrivalState(state, { serverValue: 180, pending: 40, credited: 40 })
    state = nextArrivalState(state, { serverValue: 180, pending: 0, credited: 80 })
    assert.equal(state.display, 180)
})

test('a counter with followServer off never syncs to the wallet on its own', () => {
    let state = createArrivalState({ display: 0, serverValue: 1 })
    state = nextArrivalState(state, { serverValue: 5, pending: 0, credited: 0, followServer: false })
    assert.equal(state.display, 0)

    state = nextArrivalState(state, { serverValue: 5, pending: 1, credited: 0, followServer: false })
    state = nextArrivalState(state, { serverValue: 5, pending: 0, credited: 1, followServer: false })
    assert.equal(state.display, 1, 'it climbs purely from what landed, not from the wallet')
})

test('spending mid-animation leaves the counter on the post-spend balance', () => {
    // Buying crates while Lumen is still flying in. The spend only ever shows up
    // as a wallet refresh, so a counter that kept the higher of the two readings
    // would finish on the pre-spend total and stay there - nothing afterwards
    // changes the wallet again to correct it.
    let state = createArrivalState({ display: 500, serverValue: 500 })
    state = nextArrivalState(state, { serverValue: 500, pending: 50, credited: 0 })
    assert.equal(state.display, 500)

    // 100 spent on a crate while the 50 is still arriving.
    state = nextArrivalState(state, { serverValue: 400, pending: 50, credited: 0 })
    state = nextArrivalState(state, { serverValue: 400, pending: 25, credited: 25 })
    state = nextArrivalState(state, { serverValue: 400, pending: 0, credited: 50 })
    assert.equal(state.display, 400, 'not 550')

    // And it stays put once the wallet stops moving.
    state = nextArrivalState(state, { serverValue: 400, pending: 0, credited: 50 })
    assert.equal(state.display, 400)
})

test('a wallet that only moves after the icons land still wins', () => {
    // The match-reward ordering is unchanged: a refresh that has not arrived yet
    // must not drag the counter back down.
    let state = createArrivalState({ display: 100, serverValue: 100 })
    state = nextArrivalState(state, { serverValue: 100, pending: 40, credited: 0 })
    state = nextArrivalState(state, { serverValue: 100, pending: 0, credited: 40 })
    assert.equal(state.display, 140)
})


test('a duplicate refund already in the wallet is not credited twice after a paid crate', () => {
    let state = createArrivalState({ display: 134, serverValue: 134 })
    // Spend 100 and receive a duplicate refund of 50 before the reveal.
    state = nextArrivalState(state, { serverValue: 84 })
    assert.equal(state.display, 84)
    state = nextArrivalState(state, { serverValue: 84, pending: 50, confirmedPending: 50 })
    assert.equal(state.display, 34)
    state = nextArrivalState(state, { serverValue: 84, pending: 25, confirmedPending: 25, credited: 25 })
    assert.equal(state.display, 59)
    state = nextArrivalState(state, { serverValue: 84, credited: 50 })
    assert.equal(state.display, 84, 'matches the balance used to enable purchases')
    state = nextArrivalState(state, { serverValue: 84, credited: 50 })
    assert.equal(state.display, 84)
})

test('a confirmed refund respects a subsequent spend during its animation', () => {
    let state = createArrivalState({ display: 184, serverValue: 184 })
    state = nextArrivalState(state, { serverValue: 184, pending: 50, confirmedPending: 50 })
    state = nextArrivalState(state, { serverValue: 84, pending: 25, confirmedPending: 25, credited: 25 })
    state = nextArrivalState(state, { serverValue: 84, credited: 50 })
    assert.equal(state.display, 84)
})
