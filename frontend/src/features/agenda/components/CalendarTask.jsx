import { useId } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { FaCheck } from 'react-icons/fa6'
import { flattenTaskTitle } from '../utils/naturalLanguage'

const CalendarTask = ({ task, color, onOpen }) => {
    const instanceId = useId()
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `calendar-task:${task.uid}:${instanceId}`, data: { taskId: task.uid } })
    const complete = task.status === 'Completed'

    return (
        <button
            type='button'
            ref={setNodeRef}
            {...attributes}
            {...listeners}
            onClick={(event) => {
                event.stopPropagation()
                onOpen(task, event.currentTarget)
            }}
            style={{
                '--task-color': color,
                backgroundColor: `color-mix(in srgb, ${color} 14%, var(--color-neutral6))`,
            }}
            className={`flex h-7 w-full min-w-0 touch-none cursor-grab items-center gap-1 overflow-hidden rounded-md border-l-[3px] border-[var(--task-color)] px-2 text-left text-xs transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-1 active:cursor-grabbing ${isDragging ? 'opacity-30' : complete ? 'opacity-55' : ''} ${complete ? 'line-through' : ''}`}
        >
            {complete && <FaCheck className='shrink-0 text-[9px]' />}
            <span className='truncate font-semibold'>{flattenTaskTitle(task.title) || 'Untitled task'}</span>
        </button>
    )
}

export const CalendarTaskGhost = ({ task, color, placeholder = false }) => <div aria-label={placeholder ? 'Task placement preview' : 'Dragging task'} style={{ '--task-color': color, backgroundColor: `color-mix(in srgb, ${color} 14%, var(--color-neutral6))` }} className={`pointer-events-none flex h-7 w-full min-w-0 items-center gap-1 overflow-hidden rounded-md border-l-[3px] border-[var(--task-color)] px-2 text-left text-xs ${placeholder ? 'border border-dashed border-neutral2 opacity-60' : 'shadow-lg ring-1 ring-neutral3'} ${task.status === 'Completed' ? 'line-through' : ''}`}>
    {task.status === 'Completed' && <FaCheck className='shrink-0 text-[9px]' />}
    <span className='truncate font-semibold'>{flattenTaskTitle(task.title) || 'Untitled task'}</span>
</div>

export default CalendarTask
