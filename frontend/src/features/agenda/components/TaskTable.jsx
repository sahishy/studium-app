import { useEffect, useState } from 'react'
import { FaCheck, FaTrash } from 'react-icons/fa6'
import { TaskCourseInput, TaskDueDateInput, TaskStatusInput } from './TaskInputControls'
import { normalizeTaskTitle } from '../utils/naturalLanguage'

const plainText = (title) => normalizeTaskTitle(title).segments.filter((segment) => segment.type === 'text').map((segment) => segment.rawText || '').join('').trim()

const withPlainText = (title, text) => ({
    segments: [
        { type: 'text', rawText: text, displayText: text },
        ...normalizeTaskTitle(title).segments.filter((segment) => segment.type === 'widget'),
    ],
})

const TableRow = ({ task, depth, hasChildren, courses, onUpdate, onDelete }) => {
    const [text, setText] = useState(() => plainText(task.title))
    const [controlTitle, setControlTitle] = useState(task.title)
    useEffect(() => { setText(plainText(task.title)); setControlTitle(task.title) }, [task.title])
    const saveText = () => {
        if(text.trim() && text !== plainText(task.title)) onUpdate(task.uid, { title: withPlainText(task.title, text) })
    }
    const updateControlTitle = (setter) => {
        setControlTitle((current) => {
            const next = typeof setter === 'function' ? setter(current) : setter
            onUpdate(task.uid, { title: next })
            return next
        })
    }
    const complete = task.status === 'Completed'
    return <div className='grid min-w-[760px] grid-cols-[minmax(220px,1fr)_120px_130px_160px_105px_32px] items-center gap-2 border-b border-neutral4 px-3 py-1.5 text-sm'>
        <div className='flex min-w-0 items-center gap-2' style={{ paddingLeft: Math.min(depth, 5) * 18 }}>
            <button type='button' aria-label={complete ? 'Mark incomplete' : 'Mark complete'} disabled={hasChildren} onClick={() => onUpdate(task.uid, { status: complete ? 'Incomplete' : 'Completed' })} className='flex h-5 w-5 shrink-0 items-center justify-center rounded border border-neutral3 disabled:opacity-40'>{complete && <FaCheck className='text-[10px]' />}</button>
            <input value={text} onChange={(event) => setText(event.target.value)} onBlur={saveText} onKeyDown={(event) => { if(event.key === 'Enter') event.currentTarget.blur() }} aria-label='Task title' className={`min-w-0 flex-1 bg-transparent outline-none ${complete ? 'text-neutral1 line-through' : ''}`} />
        </div>
        <TaskStatusInput status={task.status} setStatus={(status) => onUpdate(task.uid, { status })} renderTrigger={({ status }) => <button type='button' disabled={hasChildren} className='w-full rounded-lg px-2 py-1 text-left text-xs hover:bg-neutral5 disabled:opacity-50'>{status}</button>} />
        <TaskDueDateInput title={controlTitle} setTitle={updateControlTitle} renderTrigger={({ dueLabel }) => <button type='button' className='w-full rounded-lg px-2 py-1 text-left text-xs hover:bg-neutral5'>{dueLabel || 'Date'}</button>} />
        <TaskCourseInput title={controlTitle} setTitle={updateControlTitle} courses={courses} renderTrigger={({ selectedCourseId, selectedCourse }) => <button type='button' className='w-full truncate rounded-lg px-2 py-1 text-left text-xs hover:bg-neutral5'>{selectedCourseId ? selectedCourse.title : 'Course'}</button>} />
        <select aria-label='Task type' value={task.type || 'assignment'} onChange={(event) => onUpdate(task.uid, { type: event.target.value })} className='rounded-lg bg-transparent px-1 py-1 text-xs'><option value='assignment'>Assignment</option><option value='test'>Test</option></select>
        <button type='button' aria-label='Delete task' onClick={() => onDelete(task.uid)} className='rounded-lg p-1 text-neutral2 hover:text-red-500'><FaTrash className='text-xs' /></button>
    </div>
}

const TaskTable = ({ tasks, depthMap, childCounts, courses, onUpdate, onDelete, onAdd }) => {
    const [newText, setNewText] = useState('')
    const add = () => {
        if(!newText.trim()) return
        onAdd({ title: withPlainText('', newText.trim()), metadata: { taskType: 'assignment' } })
        setNewText('')
    }
    return <div className='w-full overflow-x-auto rounded-xl border border-neutral4 bg-neutral6'>
        <div className='grid min-w-[760px] grid-cols-[minmax(220px,1fr)_120px_130px_160px_105px_32px] gap-2 border-b border-neutral4 bg-neutral5/50 px-3 py-2 text-[11px] font-semibold uppercase text-neutral1'><span>Task</span><span>Status</span><span>Due date</span><span>Course</span><span>Type</span><span /></div>
        {tasks.map((task) => <TableRow key={task.uid} task={task} depth={depthMap.get(task.uid) || 0} hasChildren={(childCounts.get(task.uid) || 0) > 0} courses={courses} onUpdate={onUpdate} onDelete={onDelete} />)}
        <div className='px-3 py-2'><input value={newText} onChange={(event) => setNewText(event.target.value)} onKeyDown={(event) => { if(event.key === 'Enter') add() }} placeholder='Add task' aria-label='Add task' className='w-full bg-transparent text-sm outline-none placeholder:text-neutral2' /></div>
    </div>
}
export default TaskTable
