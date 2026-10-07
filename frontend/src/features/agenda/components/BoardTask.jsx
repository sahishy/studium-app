import { useEffect, useRef, useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { FaCheck, FaGripVertical, FaPlus, FaTrash } from 'react-icons/fa6'
import TaskParsingInput from './TaskParsingInput'
import { TaskCourseInput, TaskDueDateInput } from './TaskInputControls'

const TaskTitleEditor = ({ task, circles, courses, hideCircleWidgets, onUpdate, className = '' }) => {
    const pendingRef = useRef(null)
    return (
        <TaskParsingInput
            title={task.title}
            circles={circles}
            courses={courses}
            hideCircleWidgets={hideCircleWidgets}
            isCompleted={task.status === 'Completed'}
            className={className}
            onCommit={(payload) => { pendingRef.current = payload }}
            onEnterKey={(payload) => {
                pendingRef.current = null
                onUpdate(task.uid, { title: payload.title, type: payload.metadata.taskType || 'assignment' })
            }}
            onBlur={() => {
                const payload = pendingRef.current
                if (!payload) return
                pendingRef.current = null
                onUpdate(task.uid, { title: payload.title, type: payload.metadata.taskType || 'assignment' })
            }}
            placeholder='No title'
        />
    )
}

const NestedTask = ({ task, childrenById, circles, courses, hideCircleWidgets, onUpdate, onDelete }) => {
    const children = childrenById.get(task.uid) || []
    const complete = task.status === 'Completed'
    return (
        <div className='flex flex-col gap-1'>
            <div className='group/subtask flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-neutral5'>
                <button type='button' aria-label={complete ? 'Mark incomplete' : 'Mark complete'} disabled={children.length > 0} title={children.length ? 'Complete the subtasks first' : undefined} onClick={() => onUpdate(task.uid, { status: complete ? 'Incomplete' : 'Completed' })} className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-md border ${complete ? 'border-neutral1 bg-neutral1' : 'border-neutral2'} disabled:opacity-40`}>
                    <FaCheck className={`text-[9px] text-neutral6 ${complete ? 'opacity-100' : 'opacity-0'}`} />
                </button>
                <TaskTitleEditor task={task} circles={circles} courses={courses} hideCircleWidgets={hideCircleWidgets} onUpdate={onUpdate} className={`min-w-0 flex-1 text-sm ${complete ? 'line-through text-neutral1' : ''}`} />
                <button type='button' aria-label='Delete subtask' onClick={() => onDelete(task.uid)} className='opacity-0 transition group-hover/subtask:opacity-100'>
                    <FaTrash className='text-xs text-neutral2 hover:text-red-400' />
                </button>
            </div>
            {children.length > 0 && <div className='ml-5 border-l border-neutral4 pl-2'>{children.map((child) => <NestedTask key={child.uid} task={child} childrenById={childrenById} circles={circles} courses={courses} hideCircleWidgets={hideCircleWidgets} onUpdate={onUpdate} onDelete={onDelete} />)}</div>}
        </div>
    )
}

const BoardTask = ({ task, childrenById, circles, courses, courseColor, hideCircleWidgets, onUpdate, onDelete, onAddSubtask }) => {
    const [showSubtaskInput, setShowSubtaskInput] = useState(false)
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: task.uid,
        data: { type: 'board-task', status: task.status },
    })
    const complete = task.status === 'Completed'
    const children = childrenById.get(task.uid) || []
    const [controlTitle, setControlTitle] = useState(task.title)

    useEffect(() => setControlTitle(task.title), [task.title])
    useEffect(() => {
        if (controlTitle === task.title) return
        const timer = setTimeout(() => onUpdate(task.uid, { title: controlTitle }), 0)
        return () => clearTimeout(timer)
    }, [controlTitle, onUpdate, task.title, task.uid])

    return (
        <div
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition }}
            className={isDragging ? 'relative z-30 opacity-60' : ''}
        >
            <article style={{ borderLeftColor: courseColor }} className='group/card relative flex flex-col gap-3 rounded-xl border border-l-4 border-neutral4 bg-neutral6 p-4 shadow-sm shadow-shadow transition'>
                <div className='flex min-w-0 items-start gap-2'>
                    <button type='button' aria-label={complete ? 'Mark incomplete' : 'Mark complete'} disabled={children.length > 0} onClick={() => onUpdate(task.uid, { status: complete ? 'Incomplete' : 'Completed' })} className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-md border ${complete ? 'border-neutral1 bg-neutral1' : 'border-neutral2'} disabled:opacity-40`}>
                        <FaCheck className={`text-[9px] text-neutral6 ${complete ? 'opacity-100' : 'opacity-0'}`} />
                    </button>
                    <TaskTitleEditor task={task} circles={circles} courses={courses} hideCircleWidgets={hideCircleWidgets} onUpdate={onUpdate} className={`min-w-0 flex-1 ${complete ? 'line-through text-neutral1' : ''}`} />
                    <button
                        type='button'
                        aria-label='Drag task'
                        className='cursor-grab p-1 text-neutral2 opacity-0 transition group-hover/card:opacity-100 focus:opacity-100'
                        {...attributes}
                        {...listeners}
                    >
                        <FaGripVertical />
                    </button>
                </div>
                <div className='flex flex-wrap gap-2'>
                    <TaskDueDateInput title={controlTitle} setTitle={setControlTitle} />
                    <TaskCourseInput title={controlTitle} setTitle={setControlTitle} courses={courses} />
                </div>
                {children.length > 0 && <div className='border-t border-neutral4 pt-2'>{children.map((child) => <NestedTask key={child.uid} task={child} childrenById={childrenById} circles={circles} courses={courses} hideCircleWidgets={hideCircleWidgets} onUpdate={onUpdate} onDelete={onDelete} />)}</div>}
                {showSubtaskInput ? (
                    <div className='rounded-lg bg-neutral5 px-3 py-2'>
                        <TaskParsingInput title='' circles={circles} courses={courses} hideCircleWidgets={hideCircleWidgets} placeholder='Add a subtask' clearOnEnter onCommit={(payload) => onAddSubtask(task, payload)} onEnterKey={() => setShowSubtaskInput(false)} onBlur={() => setShowSubtaskInput(false)} />
                    </div>
                ) : (
                    <div className='flex items-center justify-between'>
                        <button type='button' onClick={() => setShowSubtaskInput(true)} className='flex items-center gap-1.5 text-xs font-semibold text-neutral1 hover:text-neutral0'><FaPlus /> Subtask</button>
                        <button type='button' aria-label='Delete task' onClick={() => onDelete(task.uid)} className='text-neutral2 opacity-0 transition hover:text-red-400 group-hover/card:opacity-100 focus:opacity-100'><FaTrash className='text-xs' /></button>
                    </div>
                )}
            </article>
        </div>
    )
}

export default BoardTask
