import test from 'node:test'
import assert from 'node:assert/strict'
import { hasTasksDueOnDate, buildTaskTree, deriveTreeStatuses, getDescendants, sortBoardTasks } from './taskViewUtils.js'

const tasks = [
    { uid: 'root', status: 'Incomplete', boardIndex: -1, listIndex: 2, parentTaskId: null },
    { uid: 'first', status: 'Completed', parentTaskId: 'root', siblingIndex: 0 },
    { uid: 'second', status: 'Incomplete', parentTaskId: 'root', siblingIndex: 1 },
]

test('builds ordered hierarchy and descendants', () => {
    const tree = buildTaskTree(tasks)
    assert.deepEqual(tree.roots.map((task) => task.uid), ['root'])
    assert.deepEqual(getDescendants('root', tree.childrenById).map((task) => task.uid), ['first', 'second'])
})

test('parent status reflects mixed and completed descendants', () => {
    assert.equal(deriveTreeStatuses(tasks).get('root'), 'In Progress')
    const statuses = deriveTreeStatuses(tasks, new Map([['second', 'Completed']]))
    assert.equal(statuses.get('root'), 'Completed')
})

test('board ordering falls back to list index and then uses board index', () => {
    const ordered = sortBoardTasks([
        { uid: 'later', boardIndex: -1, listIndex: 4 },
        { uid: 'placed', boardIndex: 0, listIndex: 9 },
        { uid: 'earlier', boardIndex: -1, listIndex: 1 },
    ])
    assert.deepEqual(ordered.map((task) => task.uid), ['placed', 'earlier', 'later'])
})

const scheduledTask = (dueDate, status = 'Incomplete', extra = {}) => ({
    status,
    title: { segments: [{ type: 'widget', widgetType: 'date', value: { dueDate } }] },
    ...extra,
})

test('due today indicator includes pending subtasks and shared tasks, excluding completed and other dates', () => {
    const date = '2026-10-09'
    assert.equal(hasTasksDueOnDate([scheduledTask(date, 'Completed'), scheduledTask('2026-10-08'), scheduledTask('2026-10-10'), { title: null }], date), false)
    assert.equal(hasTasksDueOnDate([scheduledTask(date, 'In Progress', { parentTaskId: 'parent' })], date), true)
    assert.equal(hasTasksDueOnDate([scheduledTask(date, 'Incomplete', { circleId: 'circle' })], date), true)
    assert.equal(hasTasksDueOnDate([scheduledTask(date)], '2026-10-10'), false)
    assert.equal(hasTasksDueOnDate([], date), false)
})
