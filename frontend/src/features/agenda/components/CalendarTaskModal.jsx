import { useEffect, useRef, useState } from 'react'
import { FaPlus, FaTrash } from 'react-icons/fa6'
import Button from '../../../shared/components/ui/Button'
import TaskParsingInput from './TaskParsingInput'
import { TaskCourseInput, TaskDueDateInput, TaskStatusInput } from './TaskInputControls'
import { flattenTaskTitle } from '../utils/naturalLanguage'

const CalendarTaskModal = ({ task, children = [], circles, courses, hideCircleWidgets, onSave, onDelete, onAddSubtask, closeModal }) => {
    const [title, setTitle] = useState(task.title)
    const [status, setStatus] = useState(task.status || 'Incomplete')
    const [error, setError] = useState('')
    const pendingRef = useRef(null)

    useEffect(() => setTitle(task.title), [task.title])

    const handleSave = () => {
        const payload = pendingRef.current
        const nextTitle = payload?.title || title
        if (!flattenTaskTitle(nextTitle).trim()) return
        onSave({ title: nextTitle, ...(children.length ? {} : { status }), type: payload?.metadata?.taskType || task.type || 'assignment' })
        closeModal()
    }

    return (
        <div className='flex flex-col gap-5'>
            <div>
                <h1 className='text-2xl font-semibold'>{task.isDraft ? 'New task' : 'Task details'}</h1>
                <p className='mt-1 text-sm text-neutral1'>Edits appear in List, Board, and Calendar.</p>
            </div>
            <div className='rounded-xl border border-neutral4 px-4 py-3'>
                <TaskParsingInput title={title} circles={circles} courses={courses} hideCircleWidgets={hideCircleWidgets} placeholder='Task title' onCommit={(payload) => { pendingRef.current = payload; setTitle(payload.title) }} />
            </div>
            <div className='grid grid-cols-1 gap-3 sm:grid-cols-3'>
                <div><p className='mb-2 text-xs font-semibold text-neutral1'>Status</p>{children.length ? <p className='rounded-lg bg-neutral5 px-3 py-2 text-sm' title='Based on subtasks'>{task.status} · from subtasks</p> : <TaskStatusInput status={status} setStatus={setStatus} />}</div>
                <div><p className='mb-2 text-xs font-semibold text-neutral1'>Course</p><TaskCourseInput title={title} setTitle={setTitle} courses={courses} /></div>
                <div><p className='mb-2 text-xs font-semibold text-neutral1'>Date</p><TaskDueDateInput title={title} setTitle={setTitle} /></div>
            </div>
            {children.length > 0 && <section><p className='mb-2 text-xs font-semibold uppercase tracking-wide text-neutral1'>Subtasks</p><div className='space-y-1'>{children.map((child) => <div key={child.uid} className={`rounded-lg bg-neutral5 px-3 py-2 text-sm ${child.status === 'Completed' ? 'line-through text-neutral1' : ''}`}>{flattenTaskTitle(child.title)}</div>)}</div></section>}
            {!task.isDraft && <div className='flex min-w-0 items-center gap-2 rounded-xl bg-neutral5 px-3 py-2'><FaPlus className='shrink-0 text-xs text-neutral1' /><TaskParsingInput title='' circles={circles} courses={courses} hideCircleWidgets={hideCircleWidgets} className='min-w-0 flex-1' placeholder='Add a subtask' clearOnEnter commitOnBlur={false} onCommit={(payload) => onAddSubtask(task, payload)} /></div>}
            {error && <p role='alert' className='rounded-xl bg-red-50 p-3 text-sm text-red-500'>{error}</p>}
            <div className='flex items-center justify-between gap-2'>
                {!task.isDraft ? <Button type='negative' onClick={() => { onDelete(task.uid); closeModal() }}><FaTrash /> Delete</Button> : <span />}
                <div className='flex gap-2'><Button onClick={closeModal}>Cancel</Button><Button type='primary' onClick={handleSave}>Save</Button></div>
            </div>
        </div>
    )
}

export default CalendarTaskModal
