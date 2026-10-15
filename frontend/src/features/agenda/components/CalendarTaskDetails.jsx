import { useState } from 'react'
import { FaBook, FaCalendar, FaCircleCheck, FaCircleDot, FaClock, FaXmark } from 'react-icons/fa6'
import TaskParsingInput from './TaskParsingInput'
import { TaskCourseInput, TaskDueDateInput, TaskStatusInput } from './TaskInputControls'
import TaskCardSubtasks from './TaskCardSubtasks'
import { getBoardWidgetOrder } from '../utils/boardPresentationUtils'
import { extractTaskTitleMetadata, flattenTaskTitle } from '../utils/naturalLanguage'

const CalendarTaskDetails = ({ task, childrenById, circles, courses, courseColor, hideCircleWidgets, onSave, onUpdate, onDelete, onAddSubtask, onClose }) => {
    const [draftTitle, setDraftTitle] = useState(task.title)
    const [draftType, setDraftType] = useState(task.type || 'assignment')
    const [draftStatus, setDraftStatus] = useState(task.status || 'Incomplete')
    const [error, setError] = useState('')
    const [isSaving, setIsSaving] = useState(false)
    const title = task.isDraft ? draftTitle : task.title
    const status = task.isDraft ? draftStatus : task.status
    const subtasks = childrenById.get(task.uid) || []
    const StatusIcon = status === 'Completed' ? FaCircleCheck : status === 'In Progress' ? FaClock : FaCircleDot
    const statusColor = status === 'Completed' ? 'text-emerald-400' : status === 'In Progress' ? 'text-yellow-400' : 'text-neutral2'
    const metadata = extractTaskTitleMetadata(title)
    const widgetClass = (type, isOpen) => {
        const active = type === 'status' || (type === 'date' ? metadata.dueDate : metadata.courseId)
        return !active && !isOpen ? 'hidden group-hover/card:flex group-focus-within/card:flex pointer-coarse:flex' : 'flex'
    }
    const chipClass = 'max-w-full items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-neutral1 transition hover:bg-neutral5'

    const save = async (patch) => {
        setError('')
        try { await onSave(patch) }
        catch { setError('Could not save this change. Please try again.') }
    }
    const setTitle = (next) => {
        const value = typeof next === 'function' ? next(title) : next
        if(task.isDraft) setDraftTitle(value)
        else save({ title: value })
    }
    const commitTitle = (payload) => {
        if(task.isDraft) { setDraftTitle(payload.title); setDraftType(payload.metadata?.taskType || 'assignment'); return }
        if(flattenTaskTitle(payload.title).trim()) save({ title: payload.title, type: payload.metadata?.taskType || 'assignment' })
    }
    const create = async () => {
        if(!flattenTaskTitle(title).trim()) { setError('Give your task a title.'); return }
        setIsSaving(true)
        try { await onSave({ title, status, type: draftType }); onClose() }
        catch { setError('Could not add your task. Please try again.') }
        finally { setIsSaving(false) }
    }
    const deleteTask = async () => {
        setIsSaving(true)
        try { await onDelete(task.uid); onClose() }
        catch { setError('Could not delete your task. Please try again.'); setIsSaving(false) }
    }
    return <div className='group/card relative flex flex-col gap-2'>
        <div className='flex min-w-0 items-start gap-2'>
            <TaskParsingInput title={title} circles={circles} courses={courses} hideCircleWidgets={hideCircleWidgets} isCompleted={status === 'Completed'} className={`min-w-0 flex-1 ${status === 'Completed' ? 'line-through text-neutral1' : ''}`} placeholder={task.isDraft ? 'New task' : 'Task title'} onCommit={commitTitle} />
            <button type='button' aria-label='Close task details' onClick={onClose} className='rounded-md p-1 text-neutral2 hover:bg-neutral5 hover:text-neutral0'><FaXmark className='text-xs' /></button>
        </div>
        <div className='flex min-w-0 flex-wrap items-center gap-1 text-xs text-neutral1'>
            {getBoardWidgetOrder('status', metadata).map((type) => {
                if(type === 'course') return <TaskCourseInput key={type} title={title} setTitle={setTitle} courses={courses} className='min-w-0 max-w-full' renderTrigger={({ isOpen, selectedCourseId, selectedCourse }) => <button type='button' aria-label='Task course' className={`${chipClass} ${widgetClass(type, isOpen)}`}>{selectedCourseId ? <span className='size-1.5 shrink-0 rounded-full' style={{ backgroundColor: courseColor }} /> : <FaBook className='text-[10px]' />}<span className='truncate'>{selectedCourseId ? selectedCourse.title : 'Course'}</span></button>} />
                if(type === 'date') return <TaskDueDateInput key={type} title={title} setTitle={setTitle} renderTrigger={({ isOpen, dueLabel, isOverdue }) => <button type='button' aria-label='Task due date' className={`${chipClass} ${widgetClass(type, isOpen)} ${isOverdue && status !== 'Completed' ? 'text-red-400' : ''}`}><FaCalendar className='text-[10px]' />{dueLabel || 'Date'}</button>} />
                return subtasks.length ? <span key={type} aria-description='Status follows your subtasks' className={`flex ${chipClass}`}><StatusIcon className={`text-[10px] ${statusColor}`} />{status}</span> : <TaskStatusInput key={type} status={status} setStatus={(next) => task.isDraft ? setDraftStatus(next) : save({ status: next })} renderTrigger={({ isOpen }) => <button type='button' aria-label={`Change status: ${status}`} className={`flex ${chipClass} ${isOpen ? 'bg-neutral5' : ''}`}><StatusIcon className={`text-[10px] ${statusColor}`} />{status}</button>} />
            })}
        </div>
        {!task.isDraft && <TaskCardSubtasks task={task} childrenById={childrenById} circles={circles} courses={courses} hideCircleWidgets={hideCircleWidgets} onUpdate={(id, patch) => onUpdate(id, patch).catch(() => setError('Could not update the subtask.'))} onDelete={(id) => id === task.uid ? deleteTask() : onDelete(id).catch(() => setError('Could not delete the subtask.'))} onAddSubtask={onAddSubtask} />}
        {error && <p role='alert' className='text-xs text-red-400'>{error}</p>}
        {task.isDraft && <button type='button' disabled={isSaving} onClick={create} className='self-end rounded-lg bg-neutral0 px-3 py-1.5 text-xs font-semibold text-neutral6 disabled:opacity-50'>{isSaving ? 'Adding…' : 'Add task'}</button>}
    </div>
}

export default CalendarTaskDetails
