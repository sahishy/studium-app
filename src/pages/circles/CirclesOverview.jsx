import { useOutletContext, useParams } from 'react-router-dom';
import Header from '../../components/main/Header';
import { useCircle } from '../../utils/circleUtils';
import CircleMembers from '../../components/circles/circlesOverview/CircleMembers';
import { useState } from 'react';
import { createTask, formatDate, useCircleTasks } from '../../utils/taskUtils';
import { FaPlus } from 'react-icons/fa';
import { PiCaretDownFill, PiCaretRightFill } from 'react-icons/pi';
import TasksHeader from '../../components/agenda/TasksHeader';
import Task from '../../components/agenda/Task';
import SubjectModal from '../../components/modals/SubjectModal';
import Subject from '../../components/agenda/Subject';
import { useModal } from '../../contexts/ModalContext';
import { useCircleSubjects } from '../../utils/subjectUtils';
import { useMembers } from '../../contexts/MembersContext';
import CircleLevel from '../../components/circles/circlesOverview/CircleLevel';
import CircleInvite from '../../components/circles/circlesOverview/CircleInvite';
import Button from '../main/Button';

const CirclesOverview = () => {

    const { profile } = useOutletContext()
    const { circleId } = useParams();
    const { circle, loading } = useCircle(circleId);

    const tasks = useCircleTasks([circleId]);
    const subjects = useCircleSubjects([circleId]);

    const allMembers = useMembers();

    const [collapsedDates, setCollapsedDates] = useState([])
    const [newTaskId, setNewTaskId] = useState(null)




    const tasksWithNoDueDate = tasks.filter(x => x.dueDate === -1)
    const tasksWithDueDate = tasks.filter(x => x.dueDate !== -1)

    const pastTasks = tasksWithDueDate.filter(task => new Date(task.dueDate.seconds * 1000) < new Date())
    const futureTasks = tasksWithDueDate.filter(task => new Date(task.dueDate.seconds * 1000) >= new Date())

    const groupedPastTasks = Object.groupBy(pastTasks, task => new Date(task.dueDate.seconds * 1000).toLocaleDateString())
    const groupedFutureTasks = Object.groupBy(futureTasks, task => new Date(task.dueDate.seconds * 1000).toLocaleDateString())

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
    if(!circle.userIds.includes(profile.uid)) {
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
                        <CircleLevel circle={circle}/>
                        <CircleInvite circle={circle}/>
                    </div>

                    <div className='w-full flex flex-col gap-4'>
                        <h1 className='text-lg text-text1 font-extrabold'>Members</h1>

                        <CircleMembers members={allMembers.filter(x => circle.userIds.includes(x.uid))} ownerId={circle.createdBy}/>
                    </div>

                    <div className='w-full flex flex-col items-start gap-4'>
                        <h1 className='text-lg text-text1 font-extrabold'>Subjects</h1>
                        {subjects.length < 12 && <AddSubjectButton circle={circle}/>}

                        <div className='w-full grid grid-cols-4 auto-rows-auto gap-2'>
                            {subjects.sort((a, b) => new Date(a.createdAt.seconds) - new Date(b.createdAt.seconds)).map((subject) => (
                                <Subject key={subject.uid} subject={subject}/>
                            ))}
                        </div>
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
                                        <h1 className={`text-sm text-red-400 font-extrabold`}>{formatDate(groupedPastTasks[date][0].dueDate.seconds)}</h1>
                                    </button>

                                    <div className={`w-full flex-col pl-8 ${collapsedDates.includes(date) ? 'hidden' : 'flex mb-4'}`}>
                                        <TasksHeader/>

                                        {groupedPastTasks[date].sort((a, b) => a.createdAt.seconds - b.createdAt.seconds).map((task) => (
                                            <Task key={task.uid} profile={profile} task={task} autoFocus={task.uid === newTaskId} setNewTaskId={setNewTaskId}/>
                                        ))}

                                        <AddTaskButton circle={circle} dueDate={new Date(groupedPastTasks[date][0].dueDate.seconds * 1000)} setNewTaskId={setNewTaskId} userCurrentTask={profile.currentTask}/>
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
                                    <h1 className='text-sm text-text1 font-extrabold'>No due date</h1>
                                </button>

                                <div className={`w-full flex-col pl-8 ${collapsedDates.includes('no-due-date') ? 'hidden' : 'flex mb-4'}`}>
                                    <TasksHeader/>

                                    {tasksWithNoDueDate.sort((a, b) => a.createdAt.seconds - b.createdAt.seconds).map((task) => (
                                        <Task key={task.uid} profile={profile} task={task} autoFocus={task.uid === newTaskId} setNewTaskId={setNewTaskId} userCurrentTask={profile.currentTask}/>
                                    ))}

                                    <AddTaskButton circle={circle} dueDate={-1} tasks={tasks} setNewTaskId={setNewTaskId}/>

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
                                        <h1 className={`text-sm text-text1 font-extrabold`}>{formatDate(groupedFutureTasks[date][0].dueDate.seconds)}</h1>
                                    </button>

                                    <div className={`w-full flex-col pl-8 ${collapsedDates.includes(date) ? 'hidden' : 'flex mb-4'}`}>
                                        <TasksHeader/>

                                        {groupedFutureTasks[date].sort((a, b) => a.createdAt.seconds - b.createdAt.seconds).map((task) => (
                                            <Task key={task.uid} profile={profile} task={task} autoFocus={task.uid === newTaskId} setNewTaskId={setNewTaskId} userCurrentTask={profile.currentTask}/>
                                        ))}

                                        <AddTaskButton circle={circle} dueDate={new Date(groupedFutureTasks[date][0].dueDate.seconds * 1000)} setNewTaskId={setNewTaskId}/>
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
const AddSubjectButton = ( { circle } ) => {

    const { openModal, closeModal } = useModal()

    const handleClick = () => {
        const subjectData = {
            title: '',
            day: 'A',
            color: 'gray',
            link: ''
        }
        openModal(<SubjectModal circleId={circle.uid} isEdit={false} subjectData={subjectData} closeModal={closeModal}/>)
    }

    return (
        <Button onClick={handleClick} type={'secondary'}>
            Add Subject
        </Button>
    )
}

const AddTaskButton = ( { circle, dueDate, setNewTaskId } ) => {

    const handleClick = async () => {

        const newTask = await createTask( { circleId: circle.uid, dueDate: dueDate } );
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