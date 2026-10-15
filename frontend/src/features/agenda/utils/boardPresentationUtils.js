const getBoardWidgetOrder = (groupBy, metadata = {}) => {
    const first = groupBy === 'dueDate' ? 'date' : groupBy
    const active = { status: true, course: Boolean(metadata.courseId), date: Boolean(metadata.dueDate) }
    const rest = ['status', 'course', 'date'].filter((type) => type !== first)
    return [first, ...rest.filter((type) => active[type]), ...rest.filter((type) => !active[type])]
}

const insertBoardTask = (tasks, active, overTaskId, below = false) => {
    const result = tasks.filter((task) => task.uid !== active.uid)
    const index = result.findIndex((task) => task.uid === overTaskId)
    result.splice(index < 0 ? result.length : index + Number(below), 0, active)
    return result
}

const commitBoardMove = (activeId, destination, groupPatch, commitTaskPatch) => {
    const updates = destination.map((task, boardIndex) => commitTaskPatch(task.uid, { boardIndex }))
    // Apply the column change immediately: order patches can wait in the save queue.
    if(groupPatch) updates.push(commitTaskPatch(activeId, groupPatch))
    return Promise.all(updates)
}

export { getBoardWidgetOrder, insertBoardTask, commitBoardMove }
