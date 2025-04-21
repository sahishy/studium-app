import React, { useState, useEffect } from 'react';
import BasePopover from './BasePopover';

import { PiCaretRightFill, PiCaretLeftFill } from 'react-icons/pi';

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
            <div className="rounded-lg w-max flex flex-col gap-2 text-sm">

                <div className="flex justify-between items-center">

                    <button onClick={handlePrevMonth} className="p-2 border-2 border-gray-200 border-b-4 rounded-lg hover:bg-gray-800/5 active:mt-[2px] active:border-b-2 cursor-pointer transition-all duration-200">
                        <PiCaretLeftFill/>
                    </button>

                    <div className="font-extrabold p-2">
                        {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </div>

                    <button onClick={handleNextMonth} className="p-2 border-2 border-gray-200 border-b-4 rounded-lg hover:bg-gray-800/5 active:mt-[2px] active:border-b-2 cursor-pointer transition-all duration-200">
                        <PiCaretRightFill/>
                    </button>

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
                                        className={`aspect-square cursor-pointer text-center p-1 rounded-lg flex justify-center items-center border-2 transition-colors duration-200
                                            ${dayData.currentMonth ? 'text-gray-800' : 'text-gray-400'}
                                            ${isToday ? 'border-gray-200' : 'border-transparent'}
                                            ${isSelected ? 'bg-gray-800 border-gray-800 text-white hover:bg-black' : 
                                                (isPreviousSelected ? 'bg-gray-100 hover:bg-gray-800/5' : 'bg-white hover:bg-gray-800/5')}`}
                                    >
                                        {dayData.date.getDate()}
                                    </div>
                                );

                            })

                        )}
                        
                    </div>
                
                </div>

                <div className='flex gap-2 m-2'>
                    <button
                        onClick={() => {
                            handleDateSelect(-1);
                            closePopover();
                        }}
                        className='w-full p-2 border-2 border-gray-200 border-b-4 rounded-lg hover:bg-gray-800/5 active:mt-[2px] active:border-b-2 cursor-pointer transition-all duration-200'
                    >
                        Clear
                    </button>
                    <button
                        onClick={() => {
                            handleDateSelect(currentDate);
                            closePopover();
                        }}
                        className={`w-full p-2 text-white border-black border-b-4 rounded-lg bg-gray-800 hover:bg-black active:mt-[2px] active:border-b-2 cursor-pointer transition-all duration-200`}
                    >
                        Save
                    </button>    
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