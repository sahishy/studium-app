import { useEffect, useRef, useState } from 'react'
import { useCircles } from '../../circles/contexts/CirclesContext'
import { useCourses } from '../../courses/contexts/CoursesContext'
import { enqueueTaskPatch } from '../services/taskCacheService'
import TaskParsingInput from './TaskParsingInput'
import { extractTaskTitleMetadata, flattenTaskTitle, normalizeTaskTitle, parseTaskInput } from '../utils/naturalLanguage'
import { TaskCircleInput, TaskCourseInput, TaskDueDateInput, TaskStatusInput } from './TaskInputControls'
import Card from '../../../shared/components/ui/Card'

const BoardTask = ({ profile, task, autoFocus, setNewTaskId }) => {

    const circles = useCircles()
    const { courses } = useCourses()

    const [status, setStatus] = useState(task.status)
    const [title, setTitle] = useState(normalizeTaskTitle(task.title))
    const [ownerType, setOwnerType] = useState(task.ownerType || 'user')
    const [ownerId, setOwnerId] = useState(task.ownerId || profile.uid)
    const inputRef = useRef(null)
    const pendingPayloadRef = useRef(null)

    const isInitialMount = useRef(true)
    const prevTaskRef = useRef({
        status: task.status,
        title: normalizeTaskTitle(task.title),
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
        ) {
            return
        }

        const parsedMetadata = extractTaskTitleMetadata(title)
        const plainTitle = flattenTaskTitle(title)
        const parsedTaskType = parseTaskInput(plainTitle, { courses, circles })?.parsed?.taskType || 'assignment'
        const resolvedTaskType = parsedMetadata.taskType || parsedTaskType || task.type || 'assignment'

        enqueueTaskPatch(
            task.uid,
            {
                status,
                title,
                ownerType,
                ownerId,
                type: resolvedTaskType,
            }
        )

        prevTaskRef.current = { status, title, ownerType, ownerId }
    }, [circles, courses, ownerId, ownerType, status, task.type, task.uid, title])

    useEffect(() => {
        if(task.status !== status) setStatus(task.status)
        const taskTitleText = flattenTaskTitle(task.title)
        if(taskTitleText !== flattenTaskTitle(title)) {
            setTitle(normalizeTaskTitle(task.title))
        }
        if(task.ownerType !== ownerType) setOwnerType(task.ownerType || 'user')
        if(task.ownerId !== ownerId) setOwnerId(task.ownerId || profile.uid)

        prevTaskRef.current = {
            status: task.status,
            title: normalizeTaskTitle(task.title),
            ownerType: task.ownerType || 'user',
            ownerId: task.ownerId || profile.uid,
        }
    }, [task.status, task.title, task.ownerType, task.ownerId, profile.uid, title])

    useEffect(() => {
        if(ownerType === 'circle' && !circles.some((x) => x.uid === ownerId)) {
            setOwnerType('user')
            setOwnerId(profile.uid)
        }
    }, [circles, ownerType, ownerId, profile.uid])

    useEffect(() => {
        if(autoFocus) {
            inputRef.current?.focusAtEnd?.()
        }
    }, [autoFocus])

    useEffect(() => {
        const metadata = extractTaskTitleMetadata(title)
        if (metadata.circleId) {
            if (ownerType !== 'circle' || String(ownerId) !== String(metadata.circleId)) {
                setOwnerType('circle')
                setOwnerId(metadata.circleId)
            }
            return
        }

        if (ownerType === 'circle') {
            setOwnerType('user')
            setOwnerId(profile.uid)
        }
    }, [ownerId, ownerType, profile.uid, title])

    return (
        <Card>
            <div className="flex items-center gap-2">
                <TaskStatusInput status={status} setStatus={setStatus} />
                <div className='w-full'>
                    <TaskParsingInput
                        inputRef={inputRef}
                        title={title}
                        circles={circles}
                        courses={courses}
                        className='w-full px-2 py-1'
                        placeholder='Title'
                        onCommit={(payload) => {
                            pendingPayloadRef.current = payload
                        }}
                        onEnterKey={() => {
                            const payload = pendingPayloadRef.current
                            if (!payload) return
                            setTitle(payload.title)
                            pendingPayloadRef.current = null
                        }}
                        onBlur={() => {
                            const payload = pendingPayloadRef.current
                            if (payload) {
                                setTitle(payload.title)
                                pendingPayloadRef.current = null
                            }
                            setNewTaskId?.(-1)
                        }}
                    />
                </div>
            </div>

            <div className="flex gap-3">
                <TaskDueDateInput
                    title={title}
                    setTitle={setTitle}
                    className='justify-self-start self-start max-w-full'
                />
                <TaskCircleInput
                    userId={profile.uid}
                    ownerType={ownerType}
                    ownerId={ownerId}
                    title={title}
                    setTitle={setTitle}
                    setOwnerType={setOwnerType}
                    setOwnerId={setOwnerId}
                    circles={circles}
                    className='justify-self-start self-start max-w-full'
                />
                <TaskCourseInput
                    title={title}
                    setTitle={setTitle}
                    courses={courses}
                    className='justify-self-start self-start max-w-full'
                />
            </div>
        </Card>
    )
    
}

export default BoardTask