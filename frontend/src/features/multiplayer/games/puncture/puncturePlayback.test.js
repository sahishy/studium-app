import assert from 'node:assert/strict'
import test from 'node:test'
import { flightProgress, reconcileFlights, visibleFlightPins } from './puncturePlayback.js'
const shot = (index) => ({ clientActionId: `s${index}`, shotAt: 1000 + index * 50, impactAt: 1075 + index * 50, attachedAngle: index * 20, targetAngle: index * 20, hit: false })
test('50ms inputs overlap as 75ms flights without accumulating delay', () => {
    const seen = new Set()
    let flights = []
    for(let index = 0; index < 10; index += 1) {
        flights = reconcileFlights(flights, Array.from({ length: index + 1 }, (_, i) => shot(i)), seen, 1000 + index * 50)
        assert.equal(flights.at(-1).key, `client:s${index}`)
        assert.equal(flightProgress(flights.at(-1).shot, 1000 + index * 50), 0)
        if(index) assert.equal(flights.length, 2)
    }
    assert.equal(flightProgress(shot(9), 1525), 1)
})
test('late receipts settle immediately and correction replaces a keyed flight without restarting it', () => {
    const seen = new Set()
    let flights = reconcileFlights([], [shot(0)], seen, 1000)
    flights = reconcileFlights(flights, [{ ...shot(0), attachedAngle: 12 }], seen, 1050)
    assert.equal(flights.length, 1)
    assert.equal(flightProgress(flights[0].shot, 1050), 2 / 3)
    assert.deepEqual(visibleFlightPins([12, 20], flights), [20])
    assert.deepEqual(reconcileFlights(flights, [shot(0), shot(1)], seen, 1200), [])
})
