import Task from '../../components/agenda/Task.jsx'
import TasksHeader from '../../components/agenda/TasksHeader.jsx'
import { useTasks } from '../../contexts/TasksContext.jsx'
import { createTask, formatDate } from '../../utils/taskUtils.jsx'
import { PiCaretDownFill, PiCaretRightFill } from 'react-icons/pi'
import { FaPlus } from 'react-icons/fa'
import { useOutletContext } from 'react-router-dom'
import { useState } from 'react'
import Subject from '../../components/agenda/Subject.jsx'
import SubjectModal from '../../components/modals/SubjectModal.jsx'
import { useModal } from '../../contexts/ModalContext.jsx'
import { useSubjects } from '../../contexts/SubjectsContext.jsx'

const ListTab = () => {

    const { profile } = useOutletContext()

    const { user: userTasks, circle: circleTasks } = useTasks()
    const tasks = [...userTasks, ...circleTasks];
    const { user: userSubjects } = useSubjects()

    const [collapsedDates, setCollapsedDates] = useState([]);
    const [newTaskId, setNewTaskId] = useState(null)

    const tasksWithNoDueDate = tasks.filter(x => x.dueDate === -1)
    const tasksWithDueDate = tasks.filter(x => x.dueDate !== -1)
    const pastTasks = tasksWithDueDate.filter(task => new Date(task.dueDate.seconds * 1000) < new Date())
    const futureTasks = tasksWithDueDate.filter(task => new Date(task.dueDate.seconds * 1000) >= new Date())
    const groupedPastTasks = Object.groupBy(pastTasks, task => new Date(task.dueDate.seconds * 1000).toLocaleDateString())
    const groupedFutureTasks = Object.groupBy(futureTasks, task => new Date(task.dueDate.seconds * 1000).toLocaleDateString())

    
    const handleCollapseDateToggle = (date) => {
        setCollapsedDates(collapsedDates.includes(date) ? collapsedDates.filter(x => x !== date) : [...collapsedDates, date])
    }

    return (
        <div className='w-full flex flex-col gap-8'>


            <div className='w-full flex flex-col gap-4'>
                <h1 className='text-lg text-gray-600 font-extrabold'>Subjects</h1>

                <div className='w-full grid grid-cols-4 auto-rows-auto gap-2'>
                    {userSubjects.sort((a, b) => new Date(a.createdAt.seconds) - new Date(b.createdAt.seconds)).map((subject) => (
                        <Subject key={subject.uid} subject={subject}/>
                    ))}
                    {userSubjects.length < 12 && <AddSubjectButton profile={profile}/>}
                </div>
            </div>




            <div className='w-full flex flex-col gap-4'>
                <h1 className='text-lg text-gray-600 font-extrabold'>Work</h1>
            
                <div className='w-full flex flex-col'>
                    {/* past tasks, show before all other tasks */}
                    {Object.keys(groupedPastTasks).sort((a, b) => new Date(a) - new Date(b)).map(date => (
                        <div key={date} className='w-full flex flex-col'>
                            <button
                                onClick={() => handleCollapseDateToggle(date)}
                                className='flex items-center gap-4 p-2 rounded-lg cursor-pointer hover:bg-gray-800/5 transition-colors duration-200'
                            >
                                <div className='text-sm text-gray-600'>
                                    {collapsedDates.includes(date) ? <PiCaretRightFill/> : <PiCaretDownFill/>}
                                </div>
                                <h1 className={`text-sm text-red-400 font-extrabold`}>{formatDate(groupedPastTasks[date][0].dueDate.seconds)}</h1>
                            </button>

                            <div className={`w-full flex-col pl-8 ${collapsedDates.includes(date) ? 'hidden' : 'flex mb-4'}`}>
                                <TasksHeader/>

                                {groupedPastTasks[date].sort((a, b) => a.createdAt.seconds - b.createdAt.seconds).map((task) => (
                                    <Task key={task.uid} profile={profile} task={task} autoFocus={task.uid === newTaskId} setNewTaskId={setNewTaskId}/>
                                ))}

                                <AddTaskButton profile={profile} dueDate={new Date(groupedPastTasks[date][0].dueDate.seconds * 1000)} setNewTaskId={setNewTaskId} userCurrentTask={profile.currentTask}/>
                            </div>
                        </div>
                    ))}

                    {/* no due date tasks, always show the no due date section */}
                    <div className='w-full flex flex-col'>
                        <button
                            onClick={() => handleCollapseDateToggle('no-due-date')}
                            className='flex items-center gap-4 p-2 rounded-lg cursor-pointer hover:bg-gray-800/5 transition-colors duration-200'
                        >
                            <div className='text-sm text-gray-600'>
                                {collapsedDates.includes('no-due-date') ? <PiCaretRightFill/> : <PiCaretDownFill/>}
                            </div>
                            <h1 className='text-sm text-gray-600 font-extrabold'>No due date</h1>
                        </button>

                        <div className={`w-full flex-col pl-8 ${collapsedDates.includes('no-due-date') ? 'hidden' : 'flex mb-4'}`}>
                            <TasksHeader/>

                            {tasksWithNoDueDate.sort((a, b) => a.createdAt.seconds - b.createdAt.seconds).map((task) => (
                                <Task key={task.uid} profile={profile} task={task} autoFocus={task.uid === newTaskId} setNewTaskId={setNewTaskId} userCurrentTask={profile.currentTask}/>
                            ))}

                            <AddTaskButton profile={profile} dueDate={-1} tasks={userTasks} setNewTaskId={setNewTaskId}/>

                        </div>
                    </div>

                    {/* future tasks */}
                    {Object.keys(groupedFutureTasks).sort((a, b) => new Date(a) - new Date(b)).map(date => (
                        <div key={date} className='w-full flex flex-col'>
                            <button
                                onClick={() => handleCollapseDateToggle(date)}
                                className='flex items-center gap-4 p-2 rounded-lg cursor-pointer hover:bg-gray-800/5 transition-colors duration-200'
                            >
                                <div className='text-sm text-gray-600'>
                                    {collapsedDates.includes(date) ? <PiCaretRightFill/> : <PiCaretDownFill/>}
                                </div>
                                <h1 className={`text-sm text-gray-600 font-extrabold`}>{formatDate(groupedFutureTasks[date][0].dueDate.seconds)}</h1>
                            </button>

                            <div className={`w-full flex-col pl-8 ${collapsedDates.includes(date) ? 'hidden' : 'flex mb-4'}`}>
                                <TasksHeader/>

                                {groupedFutureTasks[date].sort((a, b) => a.createdAt.seconds - b.createdAt.seconds).map((task) => (
                                    <Task key={task.uid} profile={profile} task={task} autoFocus={task.uid === newTaskId} setNewTaskId={setNewTaskId} userCurrentTask={profile.currentTask}/>
                                ))}

                                <AddTaskButton profile={profile} dueDate={new Date(groupedFutureTasks[date][0].dueDate.seconds * 1000)} setNewTaskId={setNewTaskId}/>
                            </div>
                        </div>
                    ))}

                </div>                
            </div>



{/* 
            {circles.length !== 0 && (
                <div className='w-full flex flex-col gap-4'>
                    <h1 className='text-lg text-gray-600 font-extrabold'>Circle Work</h1>
                    
                    {Object.keys(circleGroupedTasks).length === 0 ? (
                        <p className='text-sm text-gray-400'>You have no upcoming Circle work.</p>
                    ) : (
                        <div className='w-full flex flex-col'>
                            {Object.keys(circleGroupedTasks).map(group => (
                                <div key={group} className='w-full flex flex-col'>
                                    <button
                                        onClick={() => handleCollapseGroupToggle(group)}
                                        className='flex items-center gap-4 p-2 rounded-lg cursor-pointer hover:bg-gray-800/5 transition-colors duration-200'
                                    >
                                        <div className='text-sm text-gray-600'>
                                            {collapsedGroups.includes(group) ? <PiCaretRightFill/> : <PiCaretDownFill/>}
                                        </div>
                                        <h1 className={`text-sm font-extrabold`}>{circles.find(x => x.uid === group).title}</h1>
                                    </button>

                                    <div className={`w-full flex-col pl-8 ${collapsedGroups.includes(group) ? 'hidden' : 'flex mb-4'}`}>
                                        <TasksHeader/>

                                        {circleGroupedTasks[group].sort((a, b) => a.dueDate.seconds - b.dueDate.seconds).map((task) => (
                                            <Task key={task.uid} circle={group} task={task} subjects={circleSubjects.filter(x => x.circleId === group)} autoFocus={task.uid === newTaskId} setNewTaskId={setNewTaskId}/>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>                           
            )} */}

            <div className='pb-16'></div>


        </div>
    )
}


const AddTaskButton = ( { profile, dueDate, setNewTaskId } ) => {

    const handleClick = async () => {

        const newTask = await createTask( { userId: profile.uid, dueDate: dueDate } );
        if(newTask && newTask.id) {
            setNewTaskId(newTask.id);
        }

    }

    return (
        <button 
            onClick={handleClick}
            className={`w-full flex items-center gap-4 p-1 hover:bg-gray-800/5 text-sm font-semibold text-gray-600 border-t-2 border-gray-200 cursor-pointer rounded-b-lg transition-colors duration-200`}
        >
            <div className='p-2 rounded-lg'>
                <FaPlus className='text-gray-400'/>
            </div>
            <h1 className='p-2 text-gray-400'>
                Add New
            </h1>
        </button>
    )
}

const AddSubjectButton = ( { profile } ) => {

    const { openModal, closeModal } = useModal()

    const handleClick = () => {
        const subjectData = {
            title: '',
            color: 'gray',
            link: ''
        }
        openModal(<SubjectModal userId={profile.uid} isEdit={false} subjectData={subjectData} closeModal={closeModal}/>)
    }

    return (
        <button
            onClick={handleClick}
            className="flex items-center justify-center gap-2 p-2 hover:bg-gray-800/5 border-2 border-dashed border-gray-200 text-gray-600 rounded-lg cursor-pointer transition-colors duration-200"
        >
            <div className='p-2 rounded-lg'>
                <FaPlus className='text-gray-400'/>
            </div>
        </button>
    )
}

export default ListTab