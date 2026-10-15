import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCircleOptions, getCircleTitle } from './taskCircleUtils.js'

test('circle options display current profile names and retain the circle ID', () => {
    assert.deepEqual(buildCircleOptions([{ uid: 'circle-a', profile: { title: 'Study circle' }, title: 'Old name' }]), [
        { uid: null, label: 'None', icon: null },
        { uid: 'circle-a', label: 'Study circle', icon: null },
    ])
})

test('long profile names truncate only in the dropdown, not the resolved widget title', () => {
    const circle = { uid: 'circle-a', profile: { title: 'A very long circle name for studying' } }
    assert.equal(buildCircleOptions([circle], { truncate: true })[1].label, `${circle.profile.title.substring(0, 25)}...`)
    assert.equal(getCircleTitle(circle), circle.profile.title)
})

test('older cached records and missing names remain usable', () => {
    assert.equal(getCircleTitle({ title: 'Cached circle' }), 'Cached circle')
    assert.equal(getCircleTitle({ name: 'Legacy circle' }), 'Legacy circle')
    assert.equal(getCircleTitle(undefined, 'Unknown'), 'Unknown')
    assert.equal(buildCircleOptions([{ uid: 'missing' }], { truncate: true })[1].label, 'Unnamed circle')
})
