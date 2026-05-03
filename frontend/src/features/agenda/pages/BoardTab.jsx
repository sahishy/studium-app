import BoardTask from '../components/BoardTask'
import { useTasks } from '../contexts/TasksContext'
import { createTask } from '../services/taskService'
import { FaPlus } from 'react-icons/fa'
import { FaDotCircle, FaClock, FaCheckCircle } from 'react-icons/fa'
import { useOutletContext } from 'react-router-dom'
import { useState } from 'react'
import BottomPadding from '../../../shared/components/ui/BottomPadding'

const BoardTab = () => {
    
    const { profile } = useOutletContext()
    const { user: userTasks, circle: circleTasks } = useTasks()
    const tasks = [...userTasks, ...circleTasks]
    const [newTaskId, setNewTaskId] = useState(-1)

    const incompleteTasks = tasks.filter(task => task.status === 'Incomplete')
    const inProgressTasks = tasks.filter(task => task.status === 'In Progress')
    const completedTasks = tasks.filter(task => task.status === 'Completed')

    const columns = [
        {
            title: 'Incomplete',
            status: 'Incomplete',
            tasks: incompleteTasks,
            icon: <FaDotCircle className="text-neutral1" />,
            bgColor: 'bg-neutral4',
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
        <div className={`flex-shrink-0 flex-1 flex flex-col gap-3 bg-neutral5/40 p-3 rounded-xl`}>

            <div className={`p-3 rounded-xl`}>
                <div className='flex items-center justify-between'>

                    <div className='flex items-center gap-3'>
                        {column.icon}
                        <h2 className='text-sm font-semibold text-neutral0'>{column.title}</h2>
                        <p className='text-sm text-neutral2'>{column.count}</p>
                    </div>
                </div>
            </div>

            <div className='flex flex-col gap-3'>

                <div className='flex flex-col gap-3'>

                    {column.tasks.map((task) => (
                        <BoardTask
                            key={task.uid}
                            profile={profile}
                            task={task}
                            autoFocus={task.uid === newTaskId}
                            setNewTaskId={setNewTaskId}
                        />
                    ))}

                </div>

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

const AddTaskButton = ({ profile, status, setNewTaskId }) => {

    const handleClick = async () => {
        const newTask = await createTask({
            ownerType: 'user',
            ownerId: profile.uid,
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
            className={`w-full flex justify-center items-center p-4 hover:bg-neutral3 text-sm font-semibold text-neutral1 border-2 border-dashed border-neutral4 cursor-pointer rounded-xl transition-colors `}
        >
            <FaPlus className='text-neutral2' />
        </button>
    )
}


export default BoardTab