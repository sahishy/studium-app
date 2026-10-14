import { useRef } from 'react'
import TaskParsingInput from './TaskParsingInput'

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

export default TaskTitleEditor
