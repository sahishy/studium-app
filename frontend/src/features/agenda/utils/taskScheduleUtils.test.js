import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCalendarDays, dateToIsoKey } from './taskScheduleUtils.js'

test('week ranges start on Sunday', () => {
    const anchor = new Date(2026, 8, 9)
    assert.deepEqual(buildCalendarDays(anchor, 'week').map(dateToIsoKey), [
        '2026-09-06', '2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12',
    ])
})

test('month ranges always contain six complete weeks', () => {
    const days = buildCalendarDays(new Date(2026, 8, 6), 'month')
    assert.equal(days.length, 42)
    assert.equal(days[0].getDay(), 0)
    assert.equal(days[41].getDay(), 6)
})
