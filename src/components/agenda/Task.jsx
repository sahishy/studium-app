import { useState, useEffect, useRef } from "react";
import { updateTask, deleteTask } from "../../utils/taskUtils";

import { FaDotCircle, FaClock, FaCheckCircle, FaHourglass, FaCalendar, FaUserFriends, FaGripVertical } from "react-icons/fa";
import { FaFolder } from "react-icons/fa6";
import { getColor } from "../../utils/subjectUtils";
import Dropdown from "../Popovers/Dropdown";
import DatePicker from "../popovers/DatePicker";
import TimePicker from "../popovers/TimePicker";
import { useCircles } from "../../contexts/CirclesContext";
import { useSubjects } from "../../contexts/SubjectsContext";

const Task = ({ profile, task, autoFocus, setNewTaskId, userCurrentTask, variant = 'list' }) => {
    
    const circles = useCircles()
    const { user: userSubjects, circle: circleSubjects } = useSubjects()

    // task data
    const [status, setStatus] = useState(task.status);
    const [title, setTitle] = useState(task.title);
    const [subject, setSubject] = useState(task.subject);
    const [timeEstimate, setTimeEstimate] = useState(task.timeEstimate);
    const [dueDate, setDueDate] = useState(task.dueDate);
    const [userId, setUserId] = useState(task.userId);
    const [circleId, setCircleId] = useState(task.circleId);

    const [titleInput, setTitleInput] = useState(task.title);
    const titleInputRef = useRef(null);

    const isInitialMount = useRef(true);
    const prevTaskRef = useRef({
        status: task.status,
        title: task.title,
        subject: task.subject,
        timeEstimate: task.timeEstimate,
        dueDate: task.dueDate,
        userId: task.userId,
        circleId: task.circleId,
    });

    //animation
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

        //if task is the exact same then don't update firebase doc
        if(status === prev.status && title === prev.title && subject === prev.subject && timeEstimate === prev.timeEstimate && userId === prev.userId && circleId === prev.circleId
            && JSON.stringify(dueDate) === JSON.stringify(prev.dueDate)) {
            return
        }

        updateTask(task.uid, { status, title, subject, timeEstimate, dueDate, userId, circleId }, userCurrentTask);
        prevTaskRef.current = { status, title, subject, timeEstimate, dueDate, userId, circleId };

    }, [status, title, subject, timeEstimate, dueDate, userId, circleId, task.uid, userCurrentTask]);

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
            if(task.subject === '' || [...userSubjects, ...circleSubjects].some(x => x.uid === task.subject)) {
                setSubject(task.subject);
            }
        }
        if(task.timeEstimate !== timeEstimate) {
            setTimeEstimate(task.timeEstimate);
        }
        if(JSON.stringify(task.dueDate) !== JSON.stringify(dueDate)) {
            setDueDate(task.dueDate);
        }
        if(task.userId !== userId) {
            setUserId(task.userId);
        }
        if(task.circleId !== circleId) {
            setCircleId(task.circleId);
        }

        prevTaskRef.current = {
            status: task.status,
            title: task.title,
            subject: task.subject,
            timeEstimate: task.timeEstimate,
            dueDate: task.dueDate,
            userId: task.userId,
            circleId: task.circleId,
        }

    }, [task.status, task.title, task.subject, task.timeEstimate, task.dueDate, task.userId, task.circleId]);

    //reset if subject or circle doesnt exist
    useEffect(() => {
        if(subject !== '' && ![...userSubjects, ...circleSubjects].some(x => x.uid === subject)) {
            console.log(`remove unknown`);
            setSubject('');
        }
    }, [userSubjects, circleSubjects])
    useEffect(() => {
        if(!circles.some(x => x.uid === circleId)) {
            setCircleId(null);
        }
    }, [circles])

    //auto focus when task is created
    useEffect(() => {
        if(autoFocus && titleInputRef.current) {
            titleInputRef.current.focus();
        }
    }, [autoFocus]);

    // board tab task
    if(variant === 'board') {
        return (
            <div className={`flex flex-col gap-3 p-4 text-sm text-text1 transition duration-200 group
                border-2 border-border rounded-xl bg-background0
                ${animate ? 'scale-95 opacity-0' : 'scale-100 opacity-100'}`}
            >
                <div className="flex items-center gap-2">
                    <StatusInput status={status} setStatus={setStatus}/>
                    <TitleInput 
                        titleInput={titleInput} 
                        setTitleInput={setTitleInput} 
                        setTitle={setTitle} 
                        inputRef={titleInputRef} 
                        taskId={task.uid} 
                        setNewTaskId={setNewTaskId}
                        variant={variant}
                    />
                </div>
            
                <div className="flex gap-3">

                    <SubjectInput 
                        subject={subject} 
                        setSubject={setSubject} 
                        subjects={userId ? userSubjects : circleSubjects.filter(x => x.circleId === circleId)}
                    />

                    <DueDateInput dueDate={dueDate} setDueDate={setDueDate}/>

                    <CircleInput 
                        userId={profile.uid} 
                        circleId={circleId} 
                        setUserId={setUserId} 
                        setCircleId={setCircleId} 
                        circles={circles}
                    />    

                </div>

            </div>
        )
    }

    // default list tab task
    if(variant === 'list') {
        return (
            <div className={`relative flex justify-between items-center gap-4 p-1 text-sm font-semibold text-text1 
                border-t-2 border-border transition duration-200 group
                ${animate ? 'scale-95 opacity-0' : 'scale-100 opacity-100'}`}
            >
                <div className="flex-2 flex items-center gap-4">
                    <StatusInput status={status} setStatus={setStatus}/>
                    <TitleInput 
                        titleInput={titleInput} 
                        setTitleInput={setTitleInput} 
                        setTitle={setTitle} 
                        inputRef={titleInputRef} 
                        taskId={task.uid} 
                        setNewTaskId={setNewTaskId}
                        variant={variant}
                    />
                </div>

                <div className="flex-1 min-w-0">
                    <SubjectInput 
                        subject={subject} 
                        setSubject={setSubject} 
                        subjects={userId ? userSubjects : circleSubjects.filter(x => x.circleId === circleId)}
                    />
                </div>
                
                <div className="flex-1 min-w-0">
                    <DueDateInput dueDate={dueDate} setDueDate={setDueDate}/>
                </div>

                <div className="flex-1 min-w-0">
                    <CircleInput 
                        userId={profile.uid} 
                        circleId={circleId} 
                        setUserId={setUserId} 
                        setCircleId={setCircleId} 
                        circles={circles}
                    />
                </div>

                <DragHandle/>
            </div>
        )
    }
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
                    className={`flex items-center bg-background3 rounded-xl cursor-pointer`}
                >
                    <div className={`p-2 rounded-xl ${isOpen && "bg-background5"} hover:bg-background5 transition-colors duration-200`}>
                        {status === "Incomplete" ? (
                            <FaDotCircle className="text-text1"/>
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

const TitleInput = ( { titleInput, setTitleInput, setTitle, inputRef, taskId, setNewTaskId, variant } ) => {

    const handleBlur = () => {
        if(titleInput === '') {
            deleteTask(taskId);
        } else {
            setTitle(titleInput);
        }
        setNewTaskId(-1);
    };

    const getStyle = () => {
        if(variant === 'board') {
            return `text-left w-full p-2 focus:outline-none text-wrap`;
        } else if(variant === 'list') {
            return `text-left w-full p-2 focus:outline-none overflow-ellipsis`;
        }
        return '';
    }

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
            className={getStyle()}
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
            { uid: '', label: <h1 className="text-text2">None</h1>, icon: null }
            , ...subjects.map((subject) => {
                return { uid: subject.uid, label: truncateOption(subject.title), icon: <FaFolder className={`text-sm ${getColor(subject.color).textStyle}`}/> }
            })
        ]
    }
    const handleSelectOption = (option) => {
        console.log(`change: ${option.uid}`)
        setSubject(option.uid)
    }

    return (

        <Dropdown
            options={getOptions()}
            onSelect={handleSelectOption}
            className="justify-self-start self-start max-w-full"
        >
            {(isOpen) =>
                <button
                    className={`w-full flex min-w-0 items-center ${subject !== '' ? getColor(getSubject().color).bgStyle : 'bg-background3'} rounded-xl cursor-pointer`}
                >
                    <div className={`flex min-w-0 items-center gap-2 p-2 rounded-xl ${isOpen && "bg-background5"} hover:bg-background5 transition-colors duration-200`}>
                        <FaFolder className={subject !== '' ? 'hidden' : 'text-text2'}/>
                        {subject !== '' && (
                            <h1 className="text-xs max-w-full truncate">{getSubject().title}</h1>
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
            className="justify-self-start self-start max-w-full"
        >
            {(isOpen) =>
                <button className="w-full flex items-center bg-background3 rounded-xl cursor-pointer">
                    <div className={`flex items-center gap-2 p-2 rounded-xl ${isOpen && "bg-background5"} hover:bg-background5 transition-colors duration-200`}>
                        <FaCalendar className={dueDate !== -1 ? 'text-text1' : 'text-text2'}/>
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

const CircleInput = ( { userId, circleId, circles, setUserId, setCircleId } ) => {

    const getCircle = () => {
        const foundCircle = circles.find(x => x.uid === circleId);
        return foundCircle != null ? foundCircle : {title:'Unknown'}
    }

    const truncateOption = (s) => {
        return s.length <= 25 ? s : `${s.substring(0, 25)}...`
    }
    
    const getOptions = () => {
        return [
            { uid: null, label: <h1 className="text-text2">None</h1>, icon: null }
            , ...circles.map((circle) => {
                return { uid: circle.uid, label: truncateOption(circle.title), icon: <FaUserFriends/> }
            })
        ]
    }
    const handleSelectOption = (option) => {
        setCircleId(option.uid)
        setUserId(option.uid === null ? userId : null);
    }
    
    return (
        <Dropdown
            options={getOptions()}
            onSelect={handleSelectOption}
            className="justify-self-start self-start max-w-full "
        >
            {(isOpen) =>
                <button
                    className={`w-full flex min-w-0 items-center bg-background3 rounded-xl cursor-pointer`}
                >
                    <div className={`flex min-w-0 items-center gap-2 p-2 rounded-xl ${isOpen && "bg-background5"} hover:bg-background5 transition-colors duration-200`}>
                        <FaUserFriends className={circleId !== null ? 'text-text1' : 'text-text2'}/>
                        {circleId !== null && (
                            <h1 className="text-xs max-w-full truncate">{getCircle().title}</h1>
                        )}
                    </div>

                </button>
            }
        </Dropdown>
    )

}

// const TimeEstimateInput = ( { timeEstimate, setTimeEstimate } ) => {

//     const onSelectTime = (amount) => {
//         setTimeEstimate(amount);
//     }

//     const formatTime = () => {

//         let h = 0;
//         let m = 0;
        
//         if(timeEstimate >= 60) {
//             h = Math.floor(timeEstimate / 60);
//         }
//         m = timeEstimate % 60;

//         return `${ h !== 0 ? `${h}hr${m !== 0 ? ` ${m}m` : ''}` : `${m}m` }`;

//     }

//     return (
        
//         <TimePicker
//             onSelect={onSelectTime}
//             selectedTime={timeEstimate}
//         >
//             {(isOpen) =>
//                 <button className="flex items-center bg-background3 rounded-xl cursor-pointer">
//                     <div className={`flex items-center gap-2 p-2 rounded-xl ${isOpen && "bg-background5"} hover:bg-background5 transition-colors duration-200`}>
//                         <FaHourglass className={timeEstimate != 0 ? 'text-text1' : 'text-text2'}/>
//                         {timeEstimate != 0 && (
//                             <h1 className="text-xs">{formatTime()}</h1>
//                         )}
//                     </div>
//                 </button>
//             }
//         </TimePicker>

//     )
// }

const DragHandle = () => {
    return (
        <div className="absolute -left-8 p-2 cursor-grab rounded-xl text-text2 hover:bg-background5 opacity-0 group-hover:opacity-100 transition duration-200">
            <FaGripVertical/>
        </div>
    )
}


export default Task