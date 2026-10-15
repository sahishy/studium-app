import test from 'node:test'
import assert from 'node:assert/strict'
import { buildReorderPlanForSection } from './taskDragDropUtils.js'

const tasks = [
    { uid: 'parent' },
    { uid: 'child-a', parentTaskId: 'parent' },
    { uid: 'grandchild', parentTaskId: 'child-a' },
    { uid: 'child-b', parentTaskId: 'parent' },
    { uid: 'other-parent' },
    { uid: 'other-child', parentTaskId: 'other-parent' },
]
const plan = (activeId, overId) => buildReorderPlanForSection({ groupedSections: [{ key: 'none', tasks }], activeId, overId })
const ids = (result) => result.reorderedSectionTasks.map((task) => task.uid)

test('subtasks cannot move to roots, another parent, or another nesting level', () => {
    for(const target of ['parent', 'other-parent', 'other-child', 'grandchild']) {
        assert.equal(plan('child-a', target), null)
    }
    assert.equal(plan('parent', 'child-b'), null)
})

test('subtasks can reorder within their parent while keeping their descendants attached', () => {
    assert.deepEqual(ids(plan('child-a', 'child-b')), ['parent', 'child-b', 'child-a', 'grandchild', 'other-parent', 'other-child'])
    assert.deepEqual(ids(plan('child-b', 'child-a')), ['parent', 'child-b', 'child-a', 'grandchild', 'other-parent', 'other-child'])
    assert.deepEqual(tasks.map((task) => task.uid), ['parent', 'child-a', 'grandchild', 'child-b', 'other-parent', 'other-child'])
})

test('moving parents carries the whole subtree so children stay under their parent', () => {
    assert.deepEqual(ids(plan('parent', 'other-parent')), ['other-parent', 'other-child', 'parent', 'child-a', 'grandchild', 'child-b'])
    assert.deepEqual(ids(plan('other-parent', 'parent')), ['other-parent', 'other-child', 'parent', 'child-a', 'grandchild', 'child-b'])
})

test('cross-section and cancelled drops leave the list unchanged', () => {
    assert.equal(plan('child-a', null), null)
    assert.equal(plan('child-a', 'child-a'), null)
    assert.equal(buildReorderPlanForSection({ groupedSections: [{ key: 'one', tasks: [{ uid: 'a' }] }, { key: 'two', tasks: [{ uid: 'b' }] }], activeId: 'a', overId: 'b' }), null)
})
