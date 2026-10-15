import { useEffect, useRef } from 'react'
import TaskParsingInput from './TaskParsingInput'

const TaskTitleEditor = ({ task, autoFocus = false, circles, courses, hideCircleWidgets, onUpdate, className = '' }) => {
    const pendingRef = useRef(null)
    const inputRef = useRef(null)
    useEffect(() => {
        if(!autoFocus) return
        inputRef.current?.focusAtEnd?.()
        inputRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }, [autoFocus])
    return (
        <TaskParsingInput
            inputRef={inputRef}
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
