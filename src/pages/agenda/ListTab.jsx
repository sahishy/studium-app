import Task from '../../components/agenda/Task.jsx'
import TasksHeader from '../../components/agenda/TasksHeader.jsx'
import { useTasks } from '../../contexts/TasksContext.jsx'
import { createTask } from '../../services/taskService.jsx'
import { formatRelativeTaskDate, toDateKeyFromSeconds } from '../../utils/formatters.jsx'
import { PiCaretDownFill, PiCaretRightFill } from 'react-icons/pi'
import { FaPlus } from 'react-icons/fa'
import { useOutletContext } from 'react-router-dom'
import { useState } from 'react'
import BottomPadding from '../../components/main/BottomPadding.jsx'

const ListTab = () => {

    const { profile } = useOutletContext()

    const { user: userTasks, circle: circleTasks } = useTasks()
    const tasks = [...userTasks, ...circleTasks];

    const [collapsedDates, setCollapsedDates] = useState([]);
    const [newTaskId, setNewTaskId] = useState(-1)

    const tasksWithNoDueDate = tasks.filter(x => x.dueAt === -1)
    const tasksWithDueDate = tasks.filter(x => x.dueAt !== -1)
    const pastTasks = tasksWithDueDate.filter(task => new Date(task.dueAt.seconds * 1000) < new Date())
    const futureTasks = tasksWithDueDate.filter(task => new Date(task.dueAt.seconds * 1000) >= new Date())
    const groupedPastTasks = Object.groupBy(pastTasks, task => toDateKeyFromSeconds(task.dueAt.seconds))
    const groupedFutureTasks = Object.groupBy(futureTasks, task => toDateKeyFromSeconds(task.dueAt.seconds))

    const handleCollapseDateToggle = (date) => {
        setCollapsedDates(collapsedDates.includes(date) ? collapsedDates.filter(x => x !== date) : [...collapsedDates, date])
    }

   const renderTaskGroup = (groupTasks, groupKey, headerText, headerStyle, alwaysShow = false) => {
        if ((!groupTasks.length && groupKey != 'no-due-date') && !alwaysShow) return null

        return (
            <div key={groupKey} className='w-full flex flex-col'>
                <button
                    onClick={() => handleCollapseDateToggle(groupKey)}
                    className='flex items-center gap-4 p-2 rounded-xl cursor-pointer hover:bg-background5 transition-colors duration-200'
                >
                    <div className='text-sm text-text2'>
                        {collapsedDates.includes(groupKey) ? <PiCaretRightFill/> : <PiCaretDownFill/>}
                    </div>
                    <h1 className={`text-sm font-extrabold ${headerStyle}`}>{headerText}</h1>
                </button>

                <div className={`w-full flex-col pl-8 ${collapsedDates.includes(groupKey) ? 'hidden' : 'flex mb-4'}`}>
                    <TasksHeader/>
                    
                    {groupTasks.map((task) => (
                        <Task 
                            key={task.uid} 
                            profile={profile} 
                            task={task} 
                            autoFocus={task.uid === newTaskId} 
                            setNewTaskId={setNewTaskId}
                            userCurrentTask={profile.currentTask}
                            variant='list'
                        />
                    ))}

                    <AddTaskButton 
                        profile={profile} 
                        dueAt={groupKey === 'no-due-date' ? -1 : new Date(groupTasks[0]?.dueAt?.seconds * 1000 || Date.now())} 
                        setNewTaskId={setNewTaskId}
                        tasksInGroup={groupTasks}
                    />
                </div>
            </div>
        )
    }

    return (
        <div className='w-full flex flex-col gap-8'>
            <div className='w-full flex flex-col'>

                {Object.keys(groupedPastTasks).sort((a, b) => new Date(a) - new Date(b)).map(date => 
                    renderTaskGroup(
                        groupedPastTasks[date],
                        date,
                        formatRelativeTaskDate(groupedPastTasks[date][0].dueAt.seconds),
                        'text-red-400'
                    )
                )}

                {renderTaskGroup(
                    tasksWithNoDueDate.sort((a, b) => new Date(a.createdAt.seconds) - new Date(b.createdAt.seconds)),
                    'no-due-date',
                    'No due date',
                    'text-text2',
                    true,
                )}

                {Object.keys(groupedFutureTasks).sort((a, b) => new Date(a) - new Date(b)).map(date =>
                    renderTaskGroup(
                        groupedFutureTasks[date],
                        date,
                        formatRelativeTaskDate(groupedFutureTasks[date][0].dueAt.seconds),
                        'text-text2',
                    )
                )}
            
            </div>
            <BottomPadding/>
        </div>
    )
}


const AddTaskButton = ( { profile, dueAt, setNewTaskId } ) => {

    const handleClick = async () => {

        const newTask = await createTask({
            ownerType: 'user',
            ownerId: profile.uid,
            createdByUserId: profile.uid,
            dueAt
        });
        if(newTask && newTask.id) {
            setNewTaskId(newTask.id);
        }

    }

    return (
        <button 
            onClick={handleClick}
            className={`w-full flex items-center gap-4 p-1 hover:bg-background5 text-sm font-semibold text-text1 border-t-2 border-border cursor-pointer rounded-b-xl transition-colors duration-200`}
        >
            <div className='p-2 rounded-xl'>
                <FaPlus className='text-text2'/>
            </div>
            <h1 className='p-2 text-text2'>
                Add New
            </h1>
        </button>
    )
}

export default ListTab