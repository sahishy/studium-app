import { useState } from 'react'
import BasePopover from './BasePopover'
import Button from '../ui/Button'
import MiniCalendar from '../ui/MiniCalendar'

const selectedDay = (value) => value && value !== -1 && Number.isFinite(value.seconds)
    ? new Date(value.seconds * 1000)
    : new Date()

const DatePicker = ({ children, selectedDate, onSelect, className = '' }) => {
    const [month, setMonth] = useState(() => selectedDay(selectedDate))
    const [date, setDate] = useState(() => selectedDay(selectedDate))
    const onOpen = () => {
        const next = selectedDay(selectedDate)
        setMonth(next)
        setDate(next)
    }
    const content = (closePopover) => <div className='flex w-64 flex-col gap-4 p-3'>
        <MiniCalendar month={month} selectedDate={date} onMonthChange={setMonth} onSelect={(day) => { setDate(day); setMonth(day) }} />
        <div className='flex justify-end gap-2 border-t border-neutral4 pt-3'>
            <Button onClick={() => { onSelect(-1); closePopover() }}>Clear</Button>
            <Button type='primary' onClick={() => {
                const endOfDay = new Date(date)
                endOfDay.setHours(23, 59, 59, 999)
                onSelect(endOfDay)
                closePopover()
            }}>Save</Button>
        </div>
    </div>
    return <BasePopover content={content} className={className} onOpen={onOpen}>{(isOpen) => children(isOpen)}</BasePopover>
}

export default DatePicker
