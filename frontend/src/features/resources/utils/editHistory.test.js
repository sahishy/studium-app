import assert from 'node:assert/strict'
import test from 'node:test'
import { COALESCE_MS, LIMIT, canRedo, canUndo, emptyHistory, record, redo, undo } from './editHistory.js'

const apart = (history, value, step = 1) => record(history, value, history.at + COALESCE_MS * step + 1)

test('separate edits each become their own step', () => {
    let history = emptyHistory('a')
    history = apart(history, 'b')
    history = apart(history, 'c')
    assert.equal(history.present, 'c')
    history = undo(history)
    assert.equal(history.present, 'b')
    history = undo(history)
    assert.equal(history.present, 'a')
    // Nothing left to undo, and asking again is harmless.
    assert.equal(canUndo(history), false)
    assert.equal(undo(history).present, 'a')
})

test('edits in quick succession collapse into one step', () => {
    let history = emptyHistory('')
    history = record(history, 'h', 1000)
    history = record(history, 'he', 1100)
    history = record(history, 'hel', 1200)
    assert.equal(history.present, 'hel')
    // One step back reaches the start of the burst, not the middle of a word.
    assert.equal(undo(history).present, '')
})

test('redo replays forward until a new edit discards it', () => {
    let history = apart(apart(emptyHistory('a'), 'b'), 'c')
    history = undo(undo(history))
    assert.equal(history.present, 'a')
    assert.equal(canRedo(history), true)
    history = redo(history)
    assert.equal(history.present, 'b')
    // Branching off a redo point throws the old future away rather than keeping two timelines.
    history = apart(history, 'x')
    assert.equal(canRedo(history), false)
    assert.equal(undo(history).present, 'b')
})

test('the stack stays bounded over a long session', () => {
    let history = emptyHistory(0)
    for(let step = 1; step <= LIMIT + 25; step += 1) history = apart(history, step)
    assert.equal(history.past.length, LIMIT)
    // The oldest states fall off the back; the most recent ones are all still there.
    assert.equal(history.past[history.past.length - 1], LIMIT + 24)
})

test('recording the same value changes nothing', () => {
    const history = apart(emptyHistory('a'), 'b')
    assert.equal(record(history, 'b', history.at + 10_000), history)
})
