import { useState } from 'react'
import { FaCheck, FaChevronRight, FaTrash } from 'react-icons/fa6'
import { TbSubtask } from 'react-icons/tb'
import TaskTitleEditor from './TaskTitleEditor'
import TaskParsingInput from './TaskParsingInput'

const NestedTask = ({ task, childrenById, circles, courses, hideCircleWidgets, onUpdate, onDelete }) => {
    const children = childrenById.get(task.uid) || []
    const complete = task.status === 'Completed'
    return (
        <div className='flex flex-col gap-1'>
            <div className='group/subtask flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-neutral5'>
                <button type='button' aria-label={complete ? 'Mark incomplete' : 'Mark complete'} disabled={children.length > 0} onClick={() => onUpdate(task.uid, { status: complete ? 'Incomplete' : 'Completed' })} className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-md border ${complete ? 'border-neutral1 bg-neutral1' : 'border-neutral2'} disabled:opacity-40`}>
                    <FaCheck className={`text-[9px] text-neutral6 ${complete ? 'opacity-100' : 'opacity-0'}`} />
                </button>
                <TaskTitleEditor task={task} circles={circles} courses={courses} hideCircleWidgets={hideCircleWidgets} onUpdate={onUpdate} className={`min-w-0 flex-1 text-sm ${complete ? 'line-through text-neutral1' : ''}`} />
                <button type='button' aria-label='Delete subtask' onClick={() => onDelete(task.uid)} className='opacity-0 transition group-hover/subtask:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100'>
                    <FaTrash className='text-xs text-neutral2 hover:text-red-400' />
                </button>
            </div>
            {children.length > 0 && <div className='ml-5 border-l border-neutral4 pl-2'>{children.map((child) => <NestedTask key={child.uid} task={child} childrenById={childrenById} circles={circles} courses={courses} hideCircleWidgets={hideCircleWidgets} onUpdate={onUpdate} onDelete={onDelete} />)}</div>}
        </div>
    )
}

const TaskCardSubtasks = ({ task, childrenById, circles, courses, hideCircleWidgets, onUpdate, onDelete, onAddSubtask, deleteButtonClassName = '' }) => {
    const [expanded, setExpanded] = useState(false)
    const children = childrenById.get(task.uid) || []
    const completed = children.filter((child) => child.status === 'Completed').length
    const deleteButton = <button type='button' aria-label='Delete task' onClick={() => onDelete(task.uid)} className={`shrink-0 p-1 text-neutral2 transition hover:text-red-400 focus-visible:opacity-100 ${deleteButtonClassName}`}><FaTrash className='text-xs' /></button>
    return <>
        {(children.length > 0 || expanded) && <div className='border-t border-neutral4/60 pt-2'>
            <div className='flex items-center gap-2'>
                <button type='button' aria-label={expanded ? 'Collapse subtasks' : 'Expand subtasks'} aria-expanded={expanded} onClick={() => setExpanded((current) => !current)} className='flex min-w-0 flex-1 items-center gap-2 rounded-lg py-1 text-xs text-neutral1 hover:text-neutral0'>
                    <FaChevronRight className={`text-[9px] transition-transform ${expanded ? 'rotate-90' : ''}`} />
                    <TbSubtask className='text-base' /><span className='ml-auto text-neutral2'>{completed}/{children.length}</span>
                </button>
                {deleteButton}
            </div>
            {expanded && <div className='mt-1'>
                {children.map((child) => <NestedTask key={child.uid} task={child} childrenById={childrenById} circles={circles} courses={courses} hideCircleWidgets={hideCircleWidgets} onUpdate={onUpdate} onDelete={onDelete} />)}
                <div className='mt-1 rounded-lg bg-neutral5 px-3 py-2'>
                    <TaskParsingInput title='' circles={circles} courses={courses} hideCircleWidgets={hideCircleWidgets} placeholder='Add a subtask' clearOnEnter keepFocusOnEnter commitOnBlur={false} onCommit={(payload) => onAddSubtask(task, payload)} />
                </div>
            </div>}
        </div>}
        {!children.length && !expanded && <div className='flex items-center justify-between'>
            <button type='button' aria-label='Add subtask' aria-expanded={expanded} onClick={() => setExpanded(true)} className='flex items-center gap-1.5 text-xs text-neutral2 opacity-0 transition hover:text-neutral0 group-hover/card:opacity-100 group-focus-within/card:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100'><TbSubtask className='text-base' /></button>
            {deleteButton}
        </div>}
    </>
}

export default TaskCardSubtasks
