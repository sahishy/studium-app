import { useOutletContext, useParams } from 'react-router-dom';
import Header from '../../components/main/Header';
import { useCircle } from '../../services/circleService';
import CircleMembers from '../../components/circles/overview/CircleMembers.jsx';
import { useState } from 'react';
import { createTask, useCircleTasks } from '../../services/taskService';
import { formatRelativeTaskDate, toDateKeyFromSeconds } from '../../utils/formatters.jsx';
import { FaPlus } from 'react-icons/fa';
import { PiCaretDownFill, PiCaretRightFill } from 'react-icons/pi';
import TasksHeader from '../../components/agenda/TasksHeader';
import Task from '../../components/agenda/Task';
import { useMembers } from '../../contexts/MembersContext';
import CircleInvite from '../../components/circles/overview/CircleInvite.jsx';
import { useCircleMembers } from '../../services/circleService';

const CirclesOverview = () => {

    const { profile } = useOutletContext()
    const { circleId } = useParams();
    const { circle, loading } = useCircle(circleId);
    const { members: circleMembers, loading: circleMembersLoading } = useCircleMembers(circleId);

    const tasks = useCircleTasks([circleId]);

    const allMembers = useMembers();
    const ownerId = circleMembers.find((member) => member.role === 'owner')?.userId || circle?.createdByUserId || circle?.createdBy

    const [collapsedDates, setCollapsedDates] = useState([])
    const [newTaskId, setNewTaskId] = useState(null)




    const tasksWithNoDueDate = tasks.filter(x => x.dueAt === -1)
    const tasksWithDueDate = tasks.filter(x => x.dueAt !== -1)

    const pastTasks = tasksWithDueDate.filter(task => new Date(task.dueAt.seconds * 1000) < new Date())
    const futureTasks = tasksWithDueDate.filter(task => new Date(task.dueAt.seconds * 1000) >= new Date())

    const groupedPastTasks = Object.groupBy(pastTasks, task => toDateKeyFromSeconds(task.dueAt.seconds))
    const groupedFutureTasks = Object.groupBy(futureTasks, task => toDateKeyFromSeconds(task.dueAt.seconds))

    const handleCollapseToggle = (date) => {
        setCollapsedDates(collapsedDates.includes(date) ? collapsedDates.filter(x => x !== date) : [...collapsedDates, date])
    }

    if(loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <p className="text-lg font-semibold text-text1">Loading circle...</p>
            </div>
        )
    }
    if(!circle) {
        return (
            <div className="flex items-center justify-center h-screen">
                <p className="text-lg font-semibold text-text1">Circle not found!</p>
            </div>
        )
    }
    if(circleMembersLoading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <p className="text-lg font-semibold text-text1">Loading circle members...</p>
            </div>
        )
    }
    if(!circleMembers.some((member) => member.userId === profile.uid)) {
        return (
            <div className="flex items-center justify-center h-screen">
                <p className="text-lg font-semibold text-text1">You aren't in that circle!</p>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full relative">
            <Header circle={circle} profile={profile} back='/circles'/>
            <div className="flex-1 overflow-y-auto relative">

                <div className='h-full w-full flex flex-col items-start gap-8 px-24 pb-8 pt-2 m-auto'>

                    <div className='w-full flex gap-4'>
                        <CircleInvite circle={circle}/>
                    </div>

                    <div className='w-full flex flex-col gap-4'>
                        <h1 className='text-lg text-text1 font-extrabold'>Members</h1>

                        <CircleMembers members={allMembers.filter((user) => circleMembers.some((member) => member.userId === user.uid))} ownerId={ownerId}/>
                    </div>



                    
                    <div className='flex-1 w-full flex flex-col gap-4 pb-16'>
                        <h1 className='text-lg text-text1 font-extrabold'>Circle Work</h1>
                        <div className='w-full flex flex-col'>

                            {/* past tasks, show before all other tasks */}
                            {Object.keys(groupedPastTasks).sort((a, b) => new Date(a) - new Date(b)).map(date => (
                                <div key={date} className='w-full flex flex-col'>
                                    <button
                                        onClick={() => handleCollapseToggle(date)}
                                        className='flex items-center gap-4 p-2 rounded-xl cursor-pointer hover:bg-background5 transition-colors duration-200'
                                    >
                                        <div className='text-sm text-text1'>
                                            {collapsedDates.includes(date) ? <PiCaretRightFill/> : <PiCaretDownFill/>}
                                        </div>
                                        <h1 className={`text-sm text-red-400 font-extrabold`}>{formatRelativeTaskDate(groupedPastTasks[date][0].dueAt.seconds)}</h1>
                                    </button>

                                    <div className={`w-full flex-col pl-8 ${collapsedDates.includes(date) ? 'hidden' : 'flex mb-4'}`}>
                                        <TasksHeader/>

                                        {groupedPastTasks[date].sort((a, b) => a.createdAt.seconds - b.createdAt.seconds).map((task) => (
                                            <Task key={task.uid} profile={profile} task={task} autoFocus={task.uid === newTaskId} setNewTaskId={setNewTaskId}/>
                                        ))}

                                        <AddTaskButton circle={circle} dueAt={new Date(groupedPastTasks[date][0].dueAt.seconds * 1000)} setNewTaskId={setNewTaskId} userCurrentTask={profile.currentTask}/>
                                    </div>
                                </div>
                            ))}

                            {/* no due date tasks, always show the no due date section */}
                            <div className='w-full flex flex-col'>
                                <button
                                    onClick={() => handleCollapseToggle('no-due-date')}
                                    className='flex items-center gap-4 p-2 rounded-xl cursor-pointer hover:bg-background5 transition-colors duration-200'
                                >
                                    <div className='text-sm text-text1'>
                                        {collapsedDates.includes('no-due-date') ? <PiCaretRightFill/> : <PiCaretDownFill/>}
                                    </div>
                                    <h1 className='text-sm text-text2 font-extrabold'>No due date</h1>
                                </button>

                                <div className={`w-full flex-col pl-8 ${collapsedDates.includes('no-due-date') ? 'hidden' : 'flex mb-4'}`}>
                                    <TasksHeader/>

                                    {tasksWithNoDueDate.sort((a, b) => a.createdAt.seconds - b.createdAt.seconds).map((task) => (
                                        <Task key={task.uid} profile={profile} task={task} autoFocus={task.uid === newTaskId} setNewTaskId={setNewTaskId} userCurrentTask={profile.currentTask}/>
                                    ))}

                                    <AddTaskButton circle={circle} dueAt={-1} tasks={tasks} setNewTaskId={setNewTaskId}/>

                                </div>
                            </div>

                            {/* future tasks */}
                            {Object.keys(groupedFutureTasks).sort((a, b) => new Date(a) - new Date(b)).map(date => (
                                <div key={date} className='w-full flex flex-col'>
                                    <button
                                        onClick={() => handleCollapseToggle(date)}
                                        className='flex items-center gap-4 p-2 rounded-xl cursor-pointer hover:bg-background5 transition-colors duration-200'
                                    >
                                        <div className='text-sm text-text1'>
                                            {collapsedDates.includes(date) ? <PiCaretRightFill/> : <PiCaretDownFill/>}
                                        </div>
                                        <h1 className={`text-sm text-text1 font-extrabold`}>{formatRelativeTaskDate(groupedFutureTasks[date][0].dueAt.seconds)}</h1>
                                    </button>

                                    <div className={`w-full flex-col pl-8 ${collapsedDates.includes(date) ? 'hidden' : 'flex mb-4'}`}>
                                        <TasksHeader/>

                                        {groupedFutureTasks[date].sort((a, b) => a.createdAt.seconds - b.createdAt.seconds).map((task) => (
                                            <Task key={task.uid} profile={profile} task={task} autoFocus={task.uid === newTaskId} setNewTaskId={setNewTaskId} userCurrentTask={profile.currentTask}/>
                                        ))}

                                        <AddTaskButton circle={circle} dueAt={new Date(groupedFutureTasks[date][0].dueAt.seconds * 1000)} setNewTaskId={setNewTaskId}/>
                                    </div>
                                </div>
                            ))}
                        </div>
                        

                    </div>

                </div>
            </div>
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-background0 to-transparent"/>
        </div>
    )
    
}

const AddTaskButton = ( { circle, dueAt, setNewTaskId } ) => {

    const handleClick = async () => {

        const newTask = await createTask({
            ownerType: 'circle',
            ownerId: circle.uid,
            createdByUserId: circle.createdByUserId || circle.createdBy || null,
            dueAt
        });
        if(newTask && newTask.id) {
            setNewTaskId(newTask.id);
        }

    }

    return (
        <button 
            onClick={handleClick}
            className={`w-full flex items-center gap-4 p-1 hover:bg-background5 text-sm font-semibold text-text1 border-t-2 border-border cursor-pointer rounded-b-lg transition-colors duration-200`}
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


export default CirclesOverview