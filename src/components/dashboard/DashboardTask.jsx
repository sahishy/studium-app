import { useEffect, useState } from "react";
import { updateTask } from "../../utils/taskUtils";
import { getColor } from "../../utils/subjectUtils";
import Dropdown from "../Popovers/Dropdown";

import { FaDotCircle, FaClock, FaCheckCircle, FaHourglass, FaCalendar, FaUserFriends } from "react-icons/fa";
import { FaFolder } from "react-icons/fa6";
import { useCircles } from "../../contexts/CirclesContext";
import { useSubjects } from "../../contexts/SubjectsContext";

const DashboardTask = ( { task, userCurrentTask } ) => {

    const circles = useCircles()
    const { user: userSubjects, circle: circleSubjects } = useSubjects()

    const [status, setStatus] = useState(task.status);

    const [animate, setAnimate] = useState(false);
    useEffect(() => {

        if(status === 'Completed') {
            const timer = setTimeout(() => {
                setAnimate(true);
            }, 10);

            return () => clearTimeout(timer);
        }

    }, [status]);

    useEffect(() => {
        updateTask(task.uid, {status: status}, userCurrentTask)
    }, [status])

    return (

        <div className={`flex justify-between items-center gap-4 border-2 bg-white border-gray-200 p-2 rounded-lg
        transition duration-200 ${animate ? 'scale-95 opacity-0' : 'scale-100 opacity-100'}`}>

            <div className="flex-2 min-w-0 flex items-center gap-4">

                <StatusInput status={status} setStatus={setStatus} task={task}/>
                <Title title={task.title}/>

            </div>

            <div className="flex-1 flex">
                <Subject subject={task.subject} subjects={[...userSubjects, ...circleSubjects]}/>
            </div>

            <div className="flex-1 flex">
                <DueDate dueDate={task.dueDate}/>
            </div>

            <div className="flex-1 flex min-w-0">
                <Circle circleId={task.circleId} circles={circles}/>
            </div>

            {/* <div className="flex-1 flex">
                <TimeEstimate timeEstimate={task.timeEstimate}/>
            </div> */}

        </div>

    )
}

const StatusInput = ( { status, setStatus, task } ) => {

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


const Title = ( { title } ) => {
    return (
        <div className="truncate text-sm font-semibold text-gray-600">
            {title}
        </div>
    )
}

const Subject = ( { subject, subjects } ) => {

    const getSubject = () => {
        const foundSubject = subjects.find(x => x.uid === subject);
        return foundSubject != null ? foundSubject : {title:'Unknown', color:'gray'}
    }

    return (
        <div className={`flex items-center gap-2 p-2 rounded-lg ${subject !== '' && getColor(getSubject().color).bgStyle}`}>
            {subject !== '' ? (
                <h1 className="text-xs max-w-20 truncate text-gray-600">{getSubject().title}</h1>
            ) : (
                <FaFolder className='text-gray-200'/>
            )}
        </div>
    )

}

const DueDate = ( { dueDate } ) => {

    return (
        <div className="flex items-center gap-2 p-2">
            <FaCalendar className={`${dueDate !== -1 ? 'text-gray-600' : 'text-gray-200'}`}/>
            {dueDate !== -1 && (
                <h1 className={`text-xs ${dueDate.seconds * 1000 < Date.now() && 'text-red-400'}`}>
                    {new Date(dueDate.seconds * 1000).toLocaleDateString()}
                </h1>
            )}
        </div>
    )

}

const Circle = ( { circleId, circles } ) => {

    const getCircle = () => {
        const foundCircle = circles.find(x => x.uid === circleId);
        return foundCircle != null ? foundCircle : {title:'Unknown'}
    }

    return (
        <div className="flex items-center gap-2 p-2 min-w-0">
            <FaUserFriends className={`${circleId !== null ? 'text-gray-600' : 'text-gray-200'} shrink-0`}/>
            {circleId !== null && (
                <h1 className="text-xs max-w-20 truncate">{getCircle().title}</h1>
            )}
        </div>
    )
}

// const TimeEstimate = ( { timeEstimate } ) => {

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
        
//         <div className="flex items-center gap-2 p-2">
//             <FaHourglass className={`${timeEstimate != 0 ? 'text-gray-600' : 'text-gray-200'}`}/>
//             {timeEstimate != 0 && (
//                 <h1 className="text-xs text-gray-600">{formatTime()}</h1>
//             )}
//         </div>

//     )
// }


export default DashboardTask