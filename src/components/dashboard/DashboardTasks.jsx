import DaskboardTask from './DashboardTask.jsx'
import { useNavigate } from 'react-router-dom'
import { FaFile } from 'react-icons/fa6'
import TasksHeader from '../agenda/TasksHeader.jsx'
import { useTasks } from '../../contexts/TasksContext.jsx'
import { useSubjects } from '../../contexts/SubjectsContext.jsx'

const DashboardTasks = ( { profile } ) => {

    const navigate = useNavigate()

    const { user: myTasks, circle: circleTasks } = useTasks()
    const tasks = [...myTasks, ...circleTasks]
    
    
    return (

        <div className="flex flex-col gap-4">

            <div className="flex items-center justify-between gap-4">

                <h1 className="text-xl font-extrabold text-text1">Upcoming Work</h1>

                <a
                    onClick={() => navigate('/agenda')}
                    className="text-text2 font-extrabold group transition-all cursor-pointer"
                >
                    View All
                    <span className="block max-w-0 rounded-full group-hover:max-w-full transition-all duration-200 h-0.5 bg-text2"></span>
                </a>

            </div>

            <div className='flex flex-col gap-2'>

                {tasks.length === 0 ? (

                    <p className='text-sm text-center text-text2 p-2'>You have no upcoming tasks.</p>

                ) : (
                    <>
                        <TasksHeader/>

                        {tasks.sort((a, b) => {
                            
                            const dueA = new Date(a.dueDate.seconds * 1000);
                            const dueB = new Date(b.dueDate.seconds * 1000);

                            if(a.dueDate.seconds !== b.dueDate.seconds) {
                                return dueA - dueB;
                            }

                            const createdA = new Date(a.createdAt.seconds * 1000);
                            const createdB = new Date(b.createdAt.seconds * 1000);
                            return createdB - createdA;
                            
                        }).slice(0, 5).map((task) => (
                            <DaskboardTask key={task.uid} task={task} userCurrentTask={profile.currentTask}/>
                        ))}
                    </>
                )}

            </div>

        </div>



    )
}


export default DashboardTasks