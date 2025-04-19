import { useState, useEffect, useRef } from "react";
import { updateTask, deleteTask } from "../../utils/taskUtils";

import { FaDotCircle, FaClock, FaCheckCircle, FaHourglass, FaCalendar } from "react-icons/fa";
import { FaFolder } from "react-icons/fa6";
import { IoClose } from "react-icons/io5"
import { getColor } from "../../utils/subjectUtils";
import Dropdown from "../Popovers/Dropdown";
import DatePicker from "../popovers/DatePicker";
import TimePicker from "../popovers/TimePicker";

const Task = ( { task, subjects, autoFocus, setNewTaskId, userCurrentTask } ) => {

    const [status, setStatus] = useState(task.status);
    const [title, setTitle] = useState(task.title);
    const [subject, setSubject] = useState(task.subject);
    const [timeEstimate, setTimeEstimate] = useState(task.timeEstimate);
    const [dueDate, setDueDate] = useState(task.dueDate);
    const [titleInput, setTitleInput] = useState(task.title);
    const titleInputRef = useRef(null);

    const isInitialMount = useRef(true);
    const prevTaskRef = useRef({
        status: task.status,
        title: task.title,
        subject: task.subject,
        timeEstimate: task.timeEstimate,
        dueDate: task.dueDate
    });

    const [animate, setAnimate] = useState(false);
    useEffect(() => {

        if(status === 'Completed') {
            const timer = setTimeout(() => {
                setAnimate(true);
            }, 10);

            return () => clearTimeout(timer);
        }

    }, [status]);

    //update firebase to local changes
    useEffect(() => {

        if(isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }
        const prev = prevTaskRef.current;

        if(status === prev.status && title === prev.title && subject === prev.subject && timeEstimate === prev.timeEstimate && JSON.stringify(dueDate) === JSON.stringify(prev.dueDate)) {
            return
        }

        updateTask(task.uid, { status, title, subject, timeEstimate, dueDate }, userCurrentTask);
        prevTaskRef.current = { status, title, subject, timeEstimate, dueDate };

    }, [status, title, subject, timeEstimate, dueDate, task.uid, userCurrentTask]);

    //sync local state with firebase state
    useEffect(() => {

        if(task.status !== status) {
            setStatus(task.status)
        }
        if(task.title !== title) {
            setTitle(task.title); 
            setTitleInput(task.title);
        }
        if(task.subject !== subject) {
            setSubject(task.subject);
        }
        if(task.timeEstimate !== timeEstimate) {
            setTimeEstimate(task.timeEstimate);
        }
        if(JSON.stringify(task.dueDate) !== JSON.stringify(dueDate)) {
            setDueDate(task.dueDate);
        }

        prevTaskRef.current = {
            status: task.status,
            title: task.title,
            subject: task.subject,
            timeEstimate: task.timeEstimate,
            dueDate: task.dueDate,
        }

    }, [task.status, task.title, task.subject, task.timeEstimate, task.dueDate, status, title, titleInput, subject, timeEstimate, dueDate]);

    useEffect(() => {
        if(!subjects.some(x => x.uid === subject)) {
            setSubject('');
        }
    }, [subjects])

    useEffect(() => {
        if(autoFocus && titleInputRef.current) {
            titleInputRef.current.focus();
        }
    }, [autoFocus]);

    return (

        <div className={`flex justify-between items-center gap-4 p-1 text-sm font-semibold text-gray-600 border-t-2 border-gray-200
        transition duration-200 
        ${animate ? 'scale-95 opacity-0' : 'scale-100 opacity-100'}`}>

            <div className="flex-2 flex items-center gap-4">

                <StatusInput status={status} setStatus={setStatus}/>
                <TitleInput titleInput={titleInput} setTitleInput={setTitleInput} setTitle={setTitle} inputRef={titleInputRef} taskId={task.uid} setNewTaskId={setNewTaskId}/>

            </div>

            <div className="flex-1">
                <SubjectInput subject={subject} setSubject={setSubject} subjects={subjects}/>
            </div>

            <div className="flex-1">
                <DueDateInput dueDate={dueDate} setDueDate={setDueDate}/>
            </div>

            <div className="flex-1">
                <TimeEstimateInput timeEstimate={timeEstimate} setTimeEstimate={setTimeEstimate}/>
            </div>

            {/* <div className="p-2 rounded-lg hover:bg-gray-800/5 cursor-pointer">
                <IoClose className="text-sm font-semibold text-gray-400"/>
            </div> */}

        </div>

    )
}

const StatusInput = ( { status, setStatus } ) => {

    const handleSelectOption = (option) => {
        setStatus(option.label)
    }

    return (

        <Dropdown
            options={[
                { label: 'Incomplete', icon: <FaDotCircle className="text-sm"/> },
                { label: 'In Progress', icon: <FaClock className="text-yellow-400 text-sm"/> },
                { label: 'Completed', icon: <FaCheckCircle className="text-emerald-400 text-sm"/> },
            ]}
            onSelect={handleSelectOption}
        >
            {(isOpen) =>
                <button
                    className={`flex items-center bg-gray-100 rounded-lg cursor-pointer`}
                >
                    <div className={`p-2 rounded-lg ${isOpen && "bg-gray-800/5"} hover:bg-gray-800/5 transition-colors duration-200`}>
                        {status === "Incomplete" ? (
                            <FaDotCircle className="text-gray-600"/>
                        ) : status === "In Progress" ? (
                            <FaClock className="text-yellow-400"/>
                        ) : (
                            <FaCheckCircle className="text-emerald-400"/>
                        )}
                    </div>

                </button>
            }
        </Dropdown>

    )
}

const TitleInput = ( { titleInput, setTitleInput, setTitle, inputRef, taskId, setNewTaskId } ) => {

    const handleBlur = () => {
        if(titleInput === '') {
            deleteTask(taskId);
        } else {
            setTitle(titleInput);
        }
        setNewTaskId(null);
    };

    return (

        <input
            ref={inputRef}
            type="text"
            value={titleInput}
            placeholder="Title"
            onChange={(e) => {
                setTitleInput(e.target.value);
            }}
            onKeyUp={(e) => {
                if(e.key === 'Enter') {
                    e.target.blur()
                }
            }}
            className="text-left w-full p-2 focus:outline-none overflow-ellipsis"
            onBlur={handleBlur}
        ></input>

    )
}

const SubjectInput = ( { subject, setSubject, subjects } ) => {

    const getSubject = () => {
        const foundSubject = subjects.find(x => x.uid === subject);
        return foundSubject != null ? foundSubject : {title:'Unknown', color:'gray'}
    }

    const truncateOption = (s) => {
        return s.length <= 25 ? s : `${s.substring(0, 25)}...`
    }

    const getOptions = () => {
        return [
            { uid: '', label: <h1 className="text-gray-400">None</h1>, icon: null }
            , ...subjects.map((subject) => {
                return { uid: subject.uid, label: truncateOption(subject.title), icon: <FaFolder className={`text-sm ${getColor(subject.color).textStyle}`}/> }
            })
        ]
    }
    const handleSelectOption = (option) => {
        setSubject(option.uid)
    }

    return (

        <Dropdown
            options={getOptions()}
            onSelect={handleSelectOption}
        >
            {(isOpen) =>
                <button
                    className={`flex min-w-0 items-center ${subject !== '' ? getColor(getSubject().color).bgStyle : 'bg-gray-100'} rounded-lg cursor-pointer`}
                >
                    <div className={`flex min-w-0 items-center gap-2 p-2 rounded-lg ${isOpen && "bg-gray-800/5"} hover:bg-gray-800/5 transition-colors duration-200`}>
                        <FaFolder className={subject !== '' ? 'hidden' : 'text-gray-400'}/>
                        {subject !== '' && (
                            <h1 className="text-xs max-w-20 truncate">{getSubject().title}</h1>
                        )}
                    </div>
 
                </button>
            }
        </Dropdown>

    )

}

const DueDateInput = ( { dueDate, setDueDate } ) => {

    const onSelectDate = (date) => {
        setDueDate(date !== -1 ? { seconds: Math.floor(date.getTime() / 1000) } : -1);
    }

    return (

        <DatePicker
            onSelect={onSelectDate} 
            selectedDate={dueDate}
        >
            {(isOpen) =>
                <button className="flex items-center bg-gray-100 rounded-lg cursor-pointer">
                    <div className={`flex items-center gap-2 p-2 rounded-lg ${isOpen && "bg-gray-800/5"} hover:bg-gray-800/5 transition-colors duration-200`}>
                        <FaCalendar className={dueDate !== -1 ? 'text-gray-600' : 'text-gray-400'}/>
                        {dueDate !== -1 && (
                            <h1 className={`text-xs ${dueDate.seconds * 1000 < Date.now() && 'text-red-400'}`}>
                                {new Date(dueDate.seconds * 1000).toLocaleDateString()}
                            </h1>
                        )}
                    </div>
                </button>
            }
        </DatePicker>


    )

}

const TimeEstimateInput = ( { timeEstimate, setTimeEstimate } ) => {

    const onSelectTime = (amount) => {
        setTimeEstimate(amount);
    }

    const formatTime = () => {

        let h = 0;
        let m = 0;
        
        if(timeEstimate >= 60) {
            h = Math.floor(timeEstimate / 60);
        }
        m = timeEstimate % 60;

        return `${ h !== 0 ? `${h}hr${m !== 0 ? ` ${m}m` : ''}` : `${m}m` }`;

    }

    return (
        
        <TimePicker
            onSelect={onSelectTime}
            selectedTime={timeEstimate}
        >
            {(isOpen) =>
                <button className="flex items-center bg-gray-100 rounded-lg cursor-pointer">
                    <div className={`flex items-center gap-2 p-2 rounded-lg ${isOpen && "bg-gray-800/5"} hover:bg-gray-800/5 transition-colors duration-200`}>
                        <FaHourglass className={timeEstimate != 0 ? 'text-gray-600' : 'text-gray-400'}/>
                        {timeEstimate != 0 && (
                            <h1 className="text-xs">{formatTime()}</h1>
                        )}
                    </div>
                </button>
            }
        </TimePicker>

    )
}


export default Task