import React, { useState, useEffect } from 'react';
import BasePopover from './BasePopover';

import { PiCaretRightFill, PiCaretLeftFill } from 'react-icons/pi';
import Button from '../../pages/main/Button';

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
            <div className="rounded-xl w-max flex flex-col gap-2 text-sm">

                <div className="flex justify-between items-center">

                    <Button onClick={handlePrevMonth} type={'secondary'} className={'!p-2'}>
                        <PiCaretLeftFill/>
                    </Button>

                    <div className="font-extrabold p-2">
                        {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </div>

                    <Button onClick={handleNextMonth} type={'secondary'} className={'!p-2'}>
                        <PiCaretRightFill/>
                    </Button>

                </div>

                <div className='flex flex-col'>

                    <div className="grid grid-cols-7 gap-1">
                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                            <div key={index} className="text-center font-semibold p-1">
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
                                        className={`aspect-square cursor-pointer text-center p-1 rounded-xl flex justify-center items-center border-2 transition-colors duration-200
                                            ${dayData.currentMonth ? 'text-text0' : 'text-text2'}
                                            ${isToday ? 'border-border' : 'border-transparent'}
                                            ${isSelected ? 'bg-primary0 border-primary1 text-text4 hover:bg-primary1' : 
                                                (isPreviousSelected ? 'bg-background3 hover:bg-background5' : 'bg-background0 hover:bg-background5')}`}
                                    >
                                        {dayData.date.getDate()}
                                    </div>
                                );

                            })

                        )}
                        
                    </div>
                
                </div>

                <div className='flex gap-2 m-2'>
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