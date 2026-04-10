import { useEffect, useRef, useState } from 'react'
import { useCircles } from '../../circles/contexts/CirclesContext'
import { useCourses } from '../../courses/contexts/CoursesContext'
import { deleteTask, updateTask } from '../services/taskService'
import { extractTaskTitleMetadata, flattenTaskTitle, normalizeTaskTitle, parseTaskInput, parseTextToTaskTitle } from '../utils/naturalLanguage'
import { TaskCircleInput, TaskDueDateInput, TaskStatusInput } from './TaskInputControls'

const BoardTask = ({ profile, task, autoFocus, setNewTaskId }) => {
    const circles = useCircles()
    const { courses } = useCourses()

    const [status, setStatus] = useState(task.status)
    const initialTitle = flattenTaskTitle(task.title)
    const [title, setTitle] = useState(normalizeTaskTitle(task.title))
    const [dueAt, setDueAt] = useState(task.dueAt ?? -1)
    const [ownerType, setOwnerType] = useState(task.ownerType || 'user')
    const [ownerId, setOwnerId] = useState(task.ownerId || profile.uid)
    const [titleInput, setTitleInput] = useState(initialTitle)
    const titleInputRef = useRef(null)

    const isInitialMount = useRef(true)
    const prevTaskRef = useRef({
        status: task.status,
        title: normalizeTaskTitle(task.title),
        dueAt: task.dueAt ?? -1,
        ownerType: task.ownerType || 'user',
        ownerId: task.ownerId || profile.uid,
    })

    useEffect(() => {
        if(isInitialMount.current) {
            isInitialMount.current = false
            return
        }

        const prev = prevTaskRef.current
        if(
            status === prev.status
            && JSON.stringify(title) === JSON.stringify(prev.title)
            && ownerType === prev.ownerType
            && ownerId === prev.ownerId
            && JSON.stringify(dueAt) === JSON.stringify(prev.dueAt)
        ) {
            return
        }

        const parsedMetadata = extractTaskTitleMetadata(title)
        const plainTitle = flattenTaskTitle(title)
        const parsedTaskType = parseTaskInput(plainTitle, { courses, circles })?.parsed?.taskType || 'assignment'
        const resolvedTaskType = parsedMetadata.taskType || parsedTaskType || task.type || 'assignment'

        updateTask(
            task.uid,
            {
                status,
                title,
                dueAt,
                ownerType,
                ownerId,
                type: resolvedTaskType,
            }
        )

        prevTaskRef.current = { status, title, dueAt, ownerType, ownerId }
    }, [circles, courses, ownerId, ownerType, status, task.type, task.uid, title, dueAt])

    useEffect(() => {
        if(task.status !== status) setStatus(task.status)
        const taskTitleText = flattenTaskTitle(task.title)
        if(taskTitleText !== flattenTaskTitle(title)) {
            setTitle(normalizeTaskTitle(task.title))
            setTitleInput(taskTitleText)
        }
        if(JSON.stringify(task.dueAt ?? -1) !== JSON.stringify(dueAt)) setDueAt(task.dueAt ?? -1)
        if(task.ownerType !== ownerType) setOwnerType(task.ownerType || 'user')
        if(task.ownerId !== ownerId) setOwnerId(task.ownerId || profile.uid)

        prevTaskRef.current = {
            status: task.status,
            title: normalizeTaskTitle(task.title),
            dueAt: task.dueAt ?? -1,
            ownerType: task.ownerType || 'user',
            ownerId: task.ownerId || profile.uid,
        }
    }, [task.status, task.title, task.dueAt, task.ownerType, task.ownerId, profile.uid, title])

    useEffect(() => {
        if(ownerType === 'circle' && !circles.some((x) => x.uid === ownerId)) {
            setOwnerType('user')
            setOwnerId(profile.uid)
        }
    }, [circles, ownerType, ownerId, profile.uid])

    useEffect(() => {
        if(autoFocus && titleInputRef.current) {
            titleInputRef.current.focus()
            const valueLength = titleInputRef.current.value.length
            titleInputRef.current.setSelectionRange(valueLength, valueLength)
        }
    }, [autoFocus])

    const handleCommitTitle = (nextTitleInput) => {
        const nextText = (nextTitleInput || '').trim()
        const currentText = flattenTaskTitle(title)

        if(nextText === currentText) {
            setTitleInput(currentText)
            return
        }

        const parsed = parseTextToTaskTitle(nextText, { courses, circles })
        setTitle(parsed.title)
        setTitleInput(flattenTaskTitle(parsed.title))
    }

    return (
        <div className="flex flex-col gap-3 p-4 text-sm text-text1 group border-2 border-neutral4 rounded-xl bg-background0">
            <div className="flex items-center gap-2">
                <TaskStatusInput status={status} setStatus={setStatus} />
                <TitleInput
                    titleInput={titleInput}
                    setTitleInput={setTitleInput}
                    setTitle={handleCommitTitle}
                    inputRef={titleInputRef}
                    taskId={task.uid}
                    setNewTaskId={setNewTaskId}
                    variant="board"
                />
            </div>

            <div className="flex gap-3">
                <TaskDueDateInput
                    dueAt={dueAt}
                    setDueAt={setDueAt}
                    className='justify-self-start self-start max-w-full'
                />
                <TaskCircleInput
                    userId={profile.uid}
                    ownerType={ownerType}
                    ownerId={ownerId}
                    setOwnerType={setOwnerType}
                    setOwnerId={setOwnerId}
                    circles={circles}
                    className='justify-self-start self-start max-w-full'
                />
            </div>
        </div>
    )
}

const TitleInput = ({ titleInput, setTitleInput, setTitle, inputRef, taskId, setNewTaskId, variant, placeholder = 'Title' }) => {
    const handleBlur = () => {
        if(titleInput === '') {
            deleteTask(taskId)
        } else {
            setTitle(titleInput)
        }
        if(setNewTaskId) {
            setNewTaskId(-1)
        }
    }

    const className = variant === 'board'
        ? 'text-left w-full p-2 focus:outline-none text-wrap'
        : 'text-left w-full p-2 focus:outline-none overflow-ellipsis'

    return (
        <input
            ref={inputRef}
            type="text"
            value={titleInput}
            placeholder={placeholder}
            onChange={(e) => setTitleInput(e.target.value)}
            onKeyUp={(e) => {
                if(e.key === 'Enter') e.target.blur()
            }}
            className={className}
            onBlur={handleBlur}
        />
    )
}


export default BoardTask