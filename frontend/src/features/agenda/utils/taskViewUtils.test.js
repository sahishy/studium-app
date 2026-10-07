import test from 'node:test'
import assert from 'node:assert/strict'
import { buildTaskTree, deriveTreeStatuses, getDescendants, sortBoardTasks } from './taskViewUtils.js'

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
