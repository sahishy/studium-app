import DaskboardTask from './DashboardTask.jsx'
import { useNavigate } from 'react-router-dom'
import { FaFile } from 'react-icons/fa6'
import TasksHeader from '../agenda/TasksHeader.jsx'
import { useTasks } from '../../contexts/TasksContext.jsx'
import { useSubjects } from '../../contexts/SubjectsContext.jsx'

const DashboardTasks = ( { profile } ) => {

    const navigate = useNavigate()

    const { user: myTasks, circle: circleTasks } = useTasks()
    const { user: mySubjects, circle: circleSubjects } = useSubjects()

    const tasks = [...myTasks, ...circleTasks]
    const subjects = [...mySubjects, ...circleSubjects]
    
    
    return (

        <div className="flex flex-col gap-4 border-2 border-gray-200 bg-white p-4 rounded-lg">

            <div className="flex items-center justify-between gap-4">

                <div className="flex items-center gap-4"> 
                    <div className="p-4 bg-gray-100 rounded-lg">
                        <FaFile className="text-2xl text-gray-400"/>
                    </div>
                    <h1 className="text-2xl font-extrabold text-gray-600">Upcoming Work</h1>
                </div>

                <a
                    onClick={() => navigate('/agenda')}
                    className="text-gray-400 font-extrabold group transition-all cursor-pointer p-4"
                >
                    View All
                    <span className="block max-w-0 group-hover:max-w-full transition-all duration-200 h-0.5 bg-gray-400"></span>
                </a>

            </div>

            <div className='flex flex-col gap-2'>

                {tasks.length === 0 ? (

                    <p className='text-sm text-center text-gray-400'>You have no upcoming tasks.</p>

                ) : (
                    <>
                        <TasksHeader/>

                        {tasks.slice(0, 3).sort((a, b) => new Date(a.dueDate.seconds) - new Date(b.dueDate.seconds)).map((task) => (

                            <DaskboardTask key={task.uid} task={task} subjects={subjects} userCurrentTask={profile.currentTask}/>

                        ))}
                    </>
                )}

            </div>

        </div>



    )
}


export default DashboardTasks