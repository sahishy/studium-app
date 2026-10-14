import { useId } from 'react'
import { useDroppable } from '@dnd-kit/core'

const CalendarDropZone = ({ dueDate, className, children }) => {
    const instanceId = useId()
    const { setNodeRef } = useDroppable({ id: `calendar-date:${dueDate}:${instanceId}`, data: { dueDate } })
    return <div ref={setNodeRef} className={className}>{children}</div>
}

export default CalendarDropZone
