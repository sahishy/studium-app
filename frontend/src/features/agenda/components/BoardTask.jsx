import { useCallback, useEffect, useRef, useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { FaBook, FaCalendar, FaCircleCheck, FaCircleDot, FaClock, FaGripVertical } from 'react-icons/fa6'
import { getBoardWidgetOrder } from '../utils/boardPresentationUtils'
import TaskTitleEditor from './TaskTitleEditor'
import TaskCardSubtasks from './TaskCardSubtasks'
import { TaskCourseInput, TaskDueDateInput, TaskStatusInput } from './TaskInputControls'
import { extractTaskTitleMetadata, normalizeTaskTitle } from '../utils/naturalLanguage'

const STATUS_PRESENTATION = {
    'Incomplete': { icon: FaCircleDot, className: 'text-neutral2' },
    'In Progress': { icon: FaClock, className: 'text-yellow-400' },
    'Completed': { icon: FaCircleCheck, className: 'text-emerald-400' },
}
const statusPresentation = (status) => STATUS_PRESENTATION[status] || STATUS_PRESENTATION.Incomplete

const StatusChip = ({ status, interactive = false, isOpen = false }) => {
    const { icon: Icon, className } = statusPresentation(status)
    return <span className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-neutral1 transition ${interactive ? 'hover:bg-neutral5' : ''} ${isOpen ? 'bg-neutral5' : ''}`}><Icon className={`text-[10px] ${className}`} />{status}</span>
}

const BoardTask = ({ task, autoFocusTitle = false, groupId, groupBy = 'status', freezeLayout = false, childrenById, circles, courses, courseColor, hideCircleWidgets, onUpdate, onDelete, onAddSubtask }) => {
    const cardRef = useRef(null)
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: task.uid,
        data: { type: 'board-task', nodeRef: cardRef, status: task.status, groupId, groupBy, hasChildren: (childrenById.get(task.uid) || []).length > 0 },
    })
    const attachCard = useCallback((node) => { cardRef.current = node; setNodeRef(node) }, [setNodeRef])
    const complete = task.status === 'Completed'
    const children = childrenById.get(task.uid) || []
    const [controlTitle, setControlTitle] = useState(task.title)
    const metadata = extractTaskTitleMetadata(controlTitle)
    const widgetOrder = getBoardWidgetOrder(groupBy, metadata)
    const groupingWidget = groupBy === 'dueDate' ? 'date' : groupBy
    const widgetClass = (type, isOpen = false) => {
        const active = type === 'status' || (type === 'date' ? metadata.dueDate : metadata.courseId)
        return !active && type !== groupingWidget && !isOpen ? 'hidden group-hover/card:block group-focus-within/card:block pointer-coarse:block' : ''
    }


    useEffect(() => setControlTitle(task.title), [task.title])
    useEffect(() => {
        if (controlTitle === task.title) return
        const timer = setTimeout(() => onUpdate(task.uid, { title: controlTitle }), 0)
        return () => clearTimeout(timer)
    }, [controlTitle, onUpdate, task.title, task.uid])

    return (
        <div
            ref={attachCard}
            style={{ transform: freezeLayout || isDragging ? undefined : CSS.Transform.toString(transform), transition }}
            className={isDragging ? 'hidden' : 'shrink-0'}
        >
            <article className={`group/card relative flex flex-col gap-2 rounded-xl border p-3 transition-colors ${isDragging ? 'invisible border-transparent' : 'border-neutral4/70 bg-neutral6 hover:border-neutral3 focus-within:border-neutral3'}`}>
                <div className='flex min-w-0 items-start gap-2'>
                    <TaskTitleEditor task={task} autoFocus={autoFocusTitle} circles={circles} courses={courses} hideCircleWidgets={hideCircleWidgets} onUpdate={onUpdate} className={`min-w-0 flex-1 ${complete ? 'line-through text-neutral1' : ''}`} />
                    <button
                        type='button'
                        aria-label='Drag task'
                        className='touch-none cursor-grab active:cursor-grabbing p-1 text-neutral2 opacity-0 transition group-hover/card:opacity-100 focus:opacity-100 pointer-coarse:opacity-100'
                        {...attributes}
                        {...listeners}
                    >
                        <FaGripVertical />
                    </button>
                </div>
                <div className='flex min-w-0 flex-wrap items-center gap-1 text-xs text-neutral1'>
                    {widgetOrder.map((type) => {
                        if(type === 'date') return <TaskDueDateInput key={type} title={controlTitle} setTitle={setControlTitle} renderTrigger={({ isOpen, dueLabel, isOverdue }) => <button type='button' aria-label={metadata.dueDate ? `Due ${dueLabel}` : 'Set due date'} className={`items-center gap-1.5 rounded-lg px-2 py-1 transition hover:bg-neutral5 ${widgetClass(type, isOpen) || 'flex'} ${isOverdue && !complete ? 'text-red-400' : ''}`}><span className='inline-flex items-center gap-1.5'><FaCalendar className='text-[10px]' />{dueLabel || 'Date'}</span></button>} />
                        if(type === 'course') return <TaskCourseInput key={type} title={controlTitle} setTitle={setControlTitle} courses={courses} className='min-w-0 max-w-full' renderTrigger={({ isOpen, selectedCourseId, selectedCourse }) => <button type='button' aria-label={selectedCourseId ? `Course: ${selectedCourse.title}` : 'Set course'} className={`max-w-full rounded-lg px-2 py-1 transition hover:bg-neutral5 ${widgetClass(type, isOpen) || 'flex'}`}><span className='inline-flex max-w-full items-center gap-1.5'>{selectedCourseId ? <span className='size-1.5 shrink-0 rounded-full' style={{ backgroundColor: courseColor }} /> : <FaBook className='shrink-0 text-[10px]' />}<span className='truncate'>{selectedCourseId ? selectedCourse.title : 'Course'}</span></span></button>} />
                        return children.length
                            ? <span key={type} aria-label={`Status: ${task.status}`}><StatusChip status={task.status} /></span>
                            : <TaskStatusInput key={type} status={task.status} setStatus={(status) => onUpdate(task.uid, { status })} renderTrigger={({ isOpen }) => <button type='button' aria-label={`Change status: ${task.status}`}><StatusChip status={task.status} interactive isOpen={isOpen} /></button>} />
                    })}
                </div>
                <TaskCardSubtasks deleteButtonClassName='opacity-0 group-hover/card:opacity-100 group-focus-within/card:opacity-100 pointer-coarse:opacity-100' task={task} childrenById={childrenById} circles={circles} courses={courses} hideCircleWidgets={hideCircleWidgets} onUpdate={onUpdate} onDelete={onDelete} onAddSubtask={onAddSubtask} />
            </article>
        </div>
    )
}

export const BoardTaskGhost = ({ task, courseColor, groupBy = 'status', placeholder = false, height }) => {
    const meta = extractTaskTitleMetadata(task.title)
    return (
        <article style={{ minHeight: height }} className={`pointer-events-none flex w-full flex-col gap-2 rounded-xl border p-3 ${placeholder ? 'border-dashed border-neutral2 bg-neutral4/20 text-neutral1' : 'cursor-grabbing border-neutral3 bg-neutral6 shadow-sm shadow-black/5'}`}>
            <div className='flex min-w-0 items-start gap-2'>
                <p className={`min-w-0 flex-1 truncate text-sm ${task.status === 'Completed' ? 'text-neutral1 line-through' : ''}`}>{normalizeTaskTitle(task.title).segments.filter((segment) => segment.type === 'text').map((segment) => segment.rawText || '').join('').trim() || 'No title'}</p>
                <FaGripVertical className='mt-0.5 shrink-0 p-px text-neutral2' />
            </div>
            <div className='flex flex-wrap items-center gap-1 text-xs text-neutral1'>
                {getBoardWidgetOrder(groupBy, meta).map((type) => type === 'status' ? <StatusChip key={type} status={task.status} /> : type === 'course' && meta.courseId ? <span key={type} className='flex items-center gap-1.5 rounded-lg px-2 py-1'><span className='size-1.5 shrink-0 rounded-full' style={{ backgroundColor: courseColor }} />{task.title?.segments?.find((segment) => segment.widgetType === 'course')?.value?.title || 'Course'}</span> : type === 'date' && meta.dueDate ? <span key={type} className='flex items-center gap-1.5 rounded-lg px-2 py-1'><FaCalendar className='text-[10px]' />{meta.dueDate}</span> : null)}
            </div>
        </article>
    )
}

export default BoardTask
