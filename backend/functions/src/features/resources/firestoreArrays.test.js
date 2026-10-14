import assert from 'node:assert/strict'
import test from 'node:test'
import { pack, unpack } from './firestoreArrays.js'

const roundTrips = (value) => assert.deepEqual(unpack(pack(value)), value)

test('an expression survives the round trip unchanged', () => {
    roundTrips(['op', '+', ['op', '*', ['param', 'm'], ['var', 'u']], ['num', 1.5]])
    roundTrips(['fn', 'clamp', ['derived', 'd'], ['num', 0], ['num', 4]])
})

test('nothing stored is an array directly inside an array', () => {
    const packed = pack({ shapes: [{ points: [[['num', 1], ['num', 2]]], domain: [['num', 0], ['num', 10]] }] })

    const offends = (value) => {
        if(Array.isArray(value)) return value.some((entry) => Array.isArray(entry) || offends(entry))
        if(value && typeof value === 'object') return Object.values(value).some(offends)
        return false
    }

    assert.equal(offends(packed), false)
})

test('ordinary documents are untouched', () => {
    roundTrips({ title: 'Lesson', pages: [{ id: 'p', blocks: [{ id: 'b', type: 'text', text: 'Hi' }] }] })
    roundTrips({ options: ['a', 'b'], counts: [1, 2, 3], nothing: null, flag: true })
    // A date is a Firestore value in its own right and must not be walked into.
    const when = new Date('2026-01-01T00:00:00Z')
    assert.equal(pack({ when }).when, when)
})

test('a whole lesson page round trips', () => {
    roundTrips({
        pages: [{
            id: 'p1',
            variables: [{ id: 'v', label: 'Price', control: 'slider', min: 0, max: 10, step: 1, value: 5, options: [] }],
            blocks: [{
                id: 'b', type: 'interactive', frame: { x: 15, y: 15, w: 70, h: 70 },
                shapes: [{ id: 'c', kind: 'curve', x: ['var', 'u'], y: ['param', 'v'], domain: [['num', 0], ['num', 10]] }],
                readouts: [{ id: 'r', expr: ['op', '/', ['param', 'v'], ['num', 2]] }],
            }],
        }],
    })
})
