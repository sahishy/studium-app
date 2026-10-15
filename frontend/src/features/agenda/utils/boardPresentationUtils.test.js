import test from 'node:test'
import assert from 'node:assert/strict'
import { getBoardWidgetOrder, insertBoardTask, commitBoardMove } from './boardPresentationUtils.js'
import { pendingPatchAfterCreate } from './taskOptimisticUtils.js'
import { sortBoardTasks } from './taskViewUtils.js'

test('create acknowledgment preserves the intended column and title edits while discarding server timestamps', () => {
    const server = { uid: 'new', status: 'Incomplete', title: '', boardIndex: 3, createdAt: { seconds: 1 } }
    const local = { ...server, status: 'In Progress', title: 'Edited while saving', createdAt: new Date(), updatedAt: new Date() }
    const patch = pendingPatchAfterCreate(server, local)
    assert.deepEqual(patch, { status: 'In Progress', title: 'Edited while saving' })
    assert.equal(({ ...server, ...patch }).status, 'In Progress')
    assert.deepEqual(pendingPatchAfterCreate({ ...server, ...patch }, patch), {})
})

test('normalizing column positions appends new tasks after sparse and legacy positions', () => {
    const existing = [{ uid: 'legacy', boardIndex: -1, listIndex: 0 }, { uid: 'sparse', boardIndex: 90 }, { uid: 'first', boardIndex: 5 }]
    const ordered = sortBoardTasks(existing)
    const positioned = ordered.map((task, boardIndex) => ({ ...task, boardIndex }))
    assert.deepEqual(sortBoardTasks([...positioned, { uid: 'new', boardIndex: positioned.length }]).map((task) => task.uid), ['first', 'sparse', 'legacy', 'new'])
})

test('grouping widget leads, followed by active widgets and unset widgets', () => {
    assert.deepEqual(getBoardWidgetOrder('status', { courseId: 'math' }), ['status', 'course', 'date'])
    assert.deepEqual(getBoardWidgetOrder('course', { dueDate: '2026-10-12' }), ['course', 'status', 'date'])
    assert.deepEqual(getBoardWidgetOrder('dueDate', { courseId: 'math' }), ['date', 'status', 'course'])
    assert.deepEqual(getBoardWidgetOrder('status', { dueDate: '2026-10-12' }), ['status', 'date', 'course'])
})

test('placement handles before, after, empty columns and same-column reordering without duplicates', () => {
    const tasks = ['a', 'b', 'c'].map((uid) => ({ uid }))
    const ids = (items) => items.map((task) => task.uid)
    assert.deepEqual(ids(insertBoardTask(tasks, tasks[0], 'b', true)), ['b', 'a', 'c'])
    assert.deepEqual(ids(insertBoardTask(tasks, tasks[2], 'a')), ['c', 'a', 'b'])
    assert.deepEqual(ids(insertBoardTask([], tasks[0], null)), ['a'])
    assert.deepEqual(ids(insertBoardTask(tasks.slice(1), tasks[0], null)), ['b', 'c', 'a'])
    assert.deepEqual(ids(tasks), ['a', 'b', 'c'])
})

test('column changes start while order saves are still pending', async () => {
    for(const groupPatch of [{ status: 'In Progress' }, { status: 'Completed' }, { title: { segments: [] } }]) {
        const calls = []
        const pending = []
        const save = commitBoardMove('moving', [{ uid: 'existing' }, { uid: 'moving' }], groupPatch, (id, patch) => {
            calls.push({ id, patch })
            return new Promise((resolve) => pending.push(resolve))
        })
        assert.deepEqual(calls, [
            { id: 'existing', patch: { boardIndex: 0 } },
            { id: 'moving', patch: { boardIndex: 1 } },
            { id: 'moving', patch: groupPatch },
        ])
        pending.forEach((resolve) => resolve())
        await save
    }
})

test('same-column reordering only saves task order', async () => {
    const calls = []
    await commitBoardMove('moving', [{ uid: 'moving' }], null, async (id, patch) => calls.push({ id, patch }))
    assert.deepEqual(calls, [{ id: 'moving', patch: { boardIndex: 0 } }])
})
