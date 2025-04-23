import { useState } from "react";
import { useTasks } from "../../contexts/TasksContext";

const CalendarTab = () => {

    const { user: userTasks } = useTasks()

    const [currentMonth, setCurrentMonth] = useState(new Date());
    const weeks = Calendar(currentMonth);

    return (
        <div className="w-full flex flex-col gap-4">

            <h1 className='text-gray-400'>Coming soon!</h1>

            {/* <h1 className="text-2xl text-center">{currentMonth.toLocaleDateString('default', { month: 'long', year: 'numeric' })}</h1>

            <div className="w-full grid grid-cols-7 border-1 border-gray-200">
                    {weeks.map((week, weekIndex) =>
                        week.map((dayData, dayIndex) => {
                            
                            const isToday = new Date().toLocaleDateString() === dayData.date.toLocaleDateString();

                            return (
                                <div
                                    key={`${weekIndex}-${dayIndex}`}
                                    className={`cursor-pointer text-center p-2 flex flex-col gap-2 border-1 transition-colors duration-200
                                        text-xs min-h-28 max-h-28
                                        ${dayData.currentMonth ? 'text-gray-800' : 'text-gray-400'}
                                        ${isToday ? 'border-gray-200' : 'border-gray-200'}
                                        'bg-gray-100 hover:bg-gray-800/5`}
                                >

                                    <div className="flex justify-end">
                                        {dayData.date.getDate()}
                                    </div>

                                    <div className="flex justify-start gap-2">

                                        {userTasks.filter(x => new Date(x.dueDate.seconds * 1000).toLocaleDateString() === dayData.date.toLocaleDateString()).map((task) => (
                                            <div className="flex justify-start bg-yellow-100 p-2 w-full rounded-lg">{task.title}</div>
                                        ))}
                                    
                                    </div>
                                    
                                </div>
                            )

                        })
                    )}
            </div> */}

        </div>
    )
}

const Calendar = (currentMonth) => {

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

export default CalendarTab