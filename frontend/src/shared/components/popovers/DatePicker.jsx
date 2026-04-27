import { useState } from 'react';
import BasePopover from './BasePopover';
import Button from '../ui/Button';
import { FaArrowLeft, FaArrowRight } from 'react-icons/fa6';

const DatePicker = ({ children, selectedDate, onSelect, className = '' }) => {

    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [currentDate, setCurrentDate] = useState(new Date(selectedDate.seconds * 1000));

    const onOpen = () => {
        if(selectedDate !== -1 && selectedDate) {
            const selectedDateObj = new Date(selectedDate.seconds * 1000);
            setCurrentMonth(new Date(selectedDateObj.getFullYear(), selectedDateObj.getMonth(), 1));
            setCurrentDate(selectedDateObj);
        } else {
            setCurrentMonth(new Date());
            setCurrentDate(new Date());
        }
    }
    
    const Calendar = () => {

        const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
        const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

        let calendarDays = [];

        const startDayIndex = monthStart.getDay();
        if(startDayIndex > 0) {
            const prevMonthLastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 0).getDate();
            for(let d = prevMonthLastDay - startDayIndex + 1; d <= prevMonthLastDay; d++) {
                calendarDays.push({
                    date: new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, d),
                    currentMonth: false,
                });
            }
        }

        for(let d = 1; d <= monthEnd.getDate(); d++) {
            calendarDays.push({
                date: new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d),
                currentMonth: true,
            });
        }

        while(calendarDays.length % 7 !== 0) {
            const nextDay = calendarDays.length - (startDayIndex + monthEnd.getDate()) + 1;
            calendarDays.push({
                date: new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, nextDay),
                currentMonth: false,
            });
        }

        let weeks = [];
        for(let i = 0; i < calendarDays.length; i += 7) {
            weeks.push(calendarDays.slice(i, i + 7));
        }
        return weeks;

    }

    const handlePrevMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    }

    const handleNextMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    }

    const handleDateSelect = (date) => {
        if(date === -1) {
            onSelect(-1);
            return;
        }
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        onSelect(endOfDay);
    }

    const datePickerContent = (closePopover) => {
        const weeks = Calendar();

        return (
            <div className="rounded-xl w-max flex flex-col gap-4 text-sm p-2">

                <div className="flex justify-between items-center">

                    <Button onClick={handlePrevMonth} type={'tertiary'} className={'!p-2'}>
                        <FaArrowLeft/>
                    </Button>

                    <div className="font-semibold text-xl p-2 text-neutral0">
                        {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </div>

                    <Button onClick={handleNextMonth} type={'tertiary'} className={'!p-2'}>
                        <FaArrowRight/>
                    </Button>

                </div>

                <div className='flex flex-col gap-1'>

                    <div className="grid grid-cols-7 gap-1">
                        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day, index) => (
                            <div key={index} className="text-center text-xs p-1 text-neutral1">
                                {day}
                            </div>
                        ))}
                    </div>
                    
                    <div className="grid grid-cols-7 gap-2">

                        {weeks.map((week, weekIndex) =>

                            week.map((dayData, dayIndex) => {
                                
                                const isToday = new Date().toLocaleDateString() === dayData.date.toLocaleDateString();
                                const isSelected = currentDate.toLocaleDateString() === dayData.date.toLocaleDateString()
                                const isPreviousSelected = new Date(selectedDate.seconds * 1000).toLocaleDateString() === dayData.date.toLocaleDateString();

                                return (
                                    <div
                                        key={`${weekIndex}-${dayIndex}`}
                                        onClick={() => {
                                            setCurrentDate(dayData.date)
                                        }}
                                        className={`aspect-square cursor-pointer text-center p-1 rounded-xl flex justify-center items-center border
                                            ${dayData.currentMonth ? 'text-text0' : 'text-text2'}
                                            ${isToday ? 'border-neutral4' : 'border-transparent'}
                                            ${isSelected ? 'bg-neutral0 border-primary1 text-text4 hover:bg-primary1' : 
                                                (isPreviousSelected ? 'bg-background3 hover:bg-background5' : 'bg-background0 hover:bg-background5')}`}
                                    >
                                        {dayData.date.getDate()}
                                    </div>
                                );

                            })

                        )}
                        
                    </div>
                
                </div>

                <div className='flex gap-2'>
                    <Button onClick={() => {
                        handleDateSelect(-1);
                        closePopover();
                    }} type={'secondary'} className={'w-full py-2'}>
                        Clear
                    </Button>

                    <Button onClick={() => {
                        handleDateSelect(currentDate);
                        closePopover();
                    }} type={'primary'} className={'w-full py-2'}>
                        Save
                    </Button>
                </div>

            </div>
        );
    };

    return (
        <BasePopover content={datePickerContent} className={className} onOpen={onOpen}>
            {(isOpen) => children(isOpen)}
        </BasePopover>
    );
};

export default DatePicker;