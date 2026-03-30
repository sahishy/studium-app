import BoardTask from '../../components/tasks/BoardTask.jsx'
import { useTasks } from '../../contexts/TasksContext.jsx'
import { createTask } from '../../services/taskService.jsx'
import { FaPlus } from 'react-icons/fa'
import { FaDotCircle, FaClock, FaCheckCircle } from 'react-icons/fa'
import { useOutletContext } from 'react-router-dom'
import { useState } from 'react'
import BottomPadding from '../../components/main/BottomPadding.jsx'

const BoardTab = () => {
    const { profile } = useOutletContext()
    const { user: userTasks, circle: circleTasks } = useTasks()
    const tasks = [...userTasks, ...circleTasks]
    const [newTaskId, setNewTaskId] = useState(-1)

    // Group tasks by status
    const incompleteTasks = tasks.filter(task => task.status === 'Incomplete')
    const inProgressTasks = tasks.filter(task => task.status === 'In Progress')
    const completedTasks = tasks.filter(task => task.status === 'Completed')

    const columns = [
        {
            title: 'Incomplete',
            status: 'Incomplete',
            tasks: incompleteTasks,
            icon: <FaDotCircle className="text-text1" />,
            bgColor: 'bg-background3',
            count: incompleteTasks.length
        },
        {
            title: 'In Progress',
            status: 'In Progress',
            tasks: inProgressTasks,
            icon: <FaClock className="text-yellow-400" />,
            bgColor: 'bg-yellow-50',
            count: inProgressTasks.length
        },
        {
            title: 'Completed',
            status: 'Completed',
            tasks: completedTasks,
            icon: <FaCheckCircle className="text-emerald-400" />,
            bgColor: 'bg-emerald-50',
            count: completedTasks.length
        }
    ]

    return (
        <div className='w-full flex flex-col gap-8'>
            <div className='w-full flex gap-4'>

                {columns.map((column) => (
                    <KanbanColumn
                        key={column.status}
                        column={column}
                        profile={profile}
                        newTaskId={newTaskId}
                        setNewTaskId={setNewTaskId}
                    />
                ))}

            </div>
            <BottomPadding />
        </div>
    )
}

const KanbanColumn = ({ column, profile, newTaskId, setNewTaskId }) => {
    return (
        <div className={`flex-shrink-0 flex-1 flex flex-col gap-3 bg-background2 p-3 rounded-xl`}>
            
            {/* Column Header */}
            <div className={`p-3 rounded-xl`}>
                <div className='flex items-center justify-between'>

                    <div className='flex items-center gap-3'>
                        {column.icon}
                        <h2 className='text-sm font-semibold text-text1'>{column.title}</h2>
                    </div>
                    <span className='text-xs font-semibold text-text2 bg-background5 px-2 py-1 rounded-full'>
                        {column.count}
                    </span>

                </div>
            </div>

            {/* Tasks Container */}
            <div className='flex flex-col gap-3'>

                {/* Tasks List */}
                <div className='flex flex-col gap-3'>

                    {column.tasks.map((task) => (
                        <BoardTask
                            key={task.uid}
                            profile={profile}
                            task={task}
                            autoFocus={task.uid === newTaskId}
                            setNewTaskId={setNewTaskId}
                            userCurrentTask={profile.currentTask}
                        />
                    ))}

                </div>

                {/* Add Task Button */}
                {column.status !== 'Completed' && (
                    <AddTaskButton
                        profile={profile}
                        status={column.status}
                        setNewTaskId={setNewTaskId}
                    />
                )}
            </div>
        </div>
    )
}

const AddTaskButton = ( { profile, status, setNewTaskId } ) => {

    const handleClick = async () => {
        const newTask = await createTask({ 
            ownerType: 'user',
            ownerId: profile.uid,
            createdByUserId: profile.uid,
            dueAt: -1,
            status: status 
        })
        
        if (newTask && newTask.id) {
            setNewTaskId(newTask.id)
        }
    }

    return (
        <button 
            onClick={handleClick}
            className={`w-full flex justify-center items-center p-4 hover:bg-background5 text-sm font-semibold text-text1 border-2 border-dashed border-neutral4 cursor-pointer rounded-xl transition-colors `}
        >
            <FaPlus className='text-text2'/>
        </button>
    )
}


export default BoardTab