import { FaCheck } from 'react-icons/fa6'
import { flattenTaskTitle } from '../utils/naturalLanguage'

const CalendarTask = ({ task, color, onOpen, onDragStart }) => {
    const complete = task.status === 'Completed'

    return (
        <button
            type='button'
            draggable
            onDragStart={(event) => onDragStart(event, task)}
            onClick={(event) => {
                event.stopPropagation()
                onOpen(task)
            }}
            style={{
                '--task-color': color,
                backgroundColor: `color-mix(in srgb, ${color} 14%, var(--color-neutral6))`,
            }}
            className={`flex h-7 w-full min-w-0 items-center gap-1 overflow-hidden rounded-md border-l-[3px] border-[var(--task-color)] px-2 text-left text-xs transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-1 ${complete ? 'opacity-55 line-through' : ''}`}
        >
            {complete && <FaCheck className='shrink-0 text-[9px]' />}
            <span className='truncate font-semibold'>{flattenTaskTitle(task.title) || 'Untitled task'}</span>
        </button>
    )
}

export default CalendarTask
