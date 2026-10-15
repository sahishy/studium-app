import { FaChevronLeft, FaChevronRight } from 'react-icons/fa6'
import useToday from '../../hooks/useToday'
import { buildCalendarDays, dateToIsoKey, startOfWeek } from '../../utils/calendarUtils'

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const MiniCalendar = ({ month, selectedDate, viewedWeek, onSelect, onMonthChange, headerAction, className = '' }) => {
    const todayKey = dateToIsoKey(useToday())
    const selectedKey = selectedDate ? dateToIsoKey(selectedDate) : null
    const weekKey = viewedWeek ? dateToIsoKey(startOfWeek(viewedWeek)) : null
    return <div className={className}>
        <div className='mb-4 flex items-center justify-between gap-2'>
            <h3 aria-live='polite' className='text-xs font-semibold'>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h3>
            <div className='flex items-center gap-3 text-neutral2'>
                <button type='button' onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label='Previous month' className='cursor-pointer hover:text-neutral0 focus-visible:outline-2'><FaChevronLeft className='text-[10px]' /></button>
                <button type='button' onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label='Next month' className='cursor-pointer hover:text-neutral0 focus-visible:outline-2'><FaChevronRight className='text-[10px]' /></button>
                {headerAction}
            </div>
        </div>
        <div className='mb-1 grid grid-cols-7 text-center text-[10px] text-neutral2'>{WEEKDAYS.map((day) => <span key={day} aria-description={day}>{day[0]}</span>)}</div>
        <div className='grid grid-cols-7'>{buildCalendarDays(month, 'month').map((day) => {
            const key = dateToIsoKey(day)
            const inWeek = weekKey && dateToIsoKey(startOfWeek(day)) === weekKey
            const selected = key === selectedKey
            return <button key={key} type='button' aria-label={day.toLocaleDateString(undefined, { dateStyle: 'full' })} aria-pressed={Boolean(inWeek || selected)} aria-current={key === todayKey ? 'date' : undefined} onClick={() => onSelect(day)} className={`flex aspect-square items-center justify-center text-[11px] transition-colors hover:bg-neutral5 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-neutral2 ${inWeek ? `bg-neutral5 ${day.getDay() === 0 ? 'rounded-l-lg' : day.getDay() === 6 ? 'rounded-r-lg' : ''}` : 'rounded-lg'} ${day.getMonth() !== month.getMonth() ? 'text-neutral2' : 'text-neutral1'}`}>
                <span className={`flex size-6 items-center justify-center rounded-full ${selected ? 'bg-neutral0 text-neutral6' : key === todayKey ? 'bg-neutral4 text-neutral0 font-semibold' : ''}`}>{day.getDate()}</span>
            </button>
        })}</div>
    </div>
}

export default MiniCalendar
