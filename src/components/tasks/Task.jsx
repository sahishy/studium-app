import { useState, useEffect, useRef } from "react";
import { updateTask, deleteTask } from "../../services/taskService";

import { FaDotCircle, FaClock, FaCheckCircle, FaCalendar, FaUserFriends, FaRegCircle } from "react-icons/fa";
import Dropdown from "../Popovers/Dropdown";
import DatePicker from "../popovers/DatePicker";
import { useCircles } from "../../contexts/CirclesContext";
import { formatDateFromSeconds } from "../../utils/formatters";
import { FaCheck } from "react-icons/fa6";

const Task = ({ profile, task, autoFocus, setNewTaskId, userCurrentTask, variant = 'list', onDeleteEmpty = null, onEnter = null }) => {

    const circles = useCircles()

    // task data
    const [status, setStatus] = useState(task.status);
    const [title, setTitle] = useState(task.title);
    const [timeEstimate, setTimeEstimate] = useState(task.timeEstimate);
    const [dueAt, setDueAt] = useState(task.dueAt ?? -1);
    const [ownerType, setOwnerType] = useState(task.ownerType || 'user');
    const [ownerId, setOwnerId] = useState(task.ownerId || profile.uid);

    const [titleInput, setTitleInput] = useState(task.title);
    const titleInputRef = useRef(null);

    const isInitialMount = useRef(true);
    const prevTaskRef = useRef({
        status: task.status,
        title: task.title,
        timeEstimate: task.timeEstimate,
        dueAt: task.dueAt ?? -1,
        ownerType: task.ownerType || 'user',
        ownerId: task.ownerId || profile.uid,
    });

    //update firebase to local changes
    useEffect(() => {
        if(isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }
        const prev = prevTaskRef.current;

        //if task is the exact same then don't update firebase doc
        if(status === prev.status && title === prev.title && timeEstimate === prev.timeEstimate && ownerType === prev.ownerType && ownerId === prev.ownerId
            && JSON.stringify(dueAt) === JSON.stringify(prev.dueAt)) {
            return
        }

        updateTask(task.uid, { status, title, timeEstimate, dueAt, ownerType, ownerId }, userCurrentTask);
        prevTaskRef.current = { status, title, timeEstimate, dueAt, ownerType, ownerId };

    }, [status, title, timeEstimate, dueAt, ownerType, ownerId, task.uid, userCurrentTask]);

    //sync local state with firebase state
    useEffect(() => {
        if(task.status !== status) {
            setStatus(task.status)
        }
        if(task.title !== title) {
            setTitle(task.title);
            setTitleInput(task.title);
        }
        if(task.timeEstimate !== timeEstimate) {
            setTimeEstimate(task.timeEstimate);
        }
        if(JSON.stringify(task.dueAt ?? -1) !== JSON.stringify(dueAt)) {
            setDueAt(task.dueAt ?? -1);
        }
        if(task.ownerType !== ownerType) {
            setOwnerType(task.ownerType || 'user');
        }
        if(task.ownerId !== ownerId) {
            setOwnerId(task.ownerId || profile.uid);
        }

        prevTaskRef.current = {
            status: task.status,
            title: task.title,
            timeEstimate: task.timeEstimate,
            dueAt: task.dueAt ?? -1,
            ownerType: task.ownerType || 'user',
            ownerId: task.ownerId || profile.uid,
        }

    }, [task.status, task.title, task.timeEstimate, task.dueAt, task.ownerType, task.ownerId, profile.uid]);

    //reset if circle doesnt exist
    useEffect(() => {
        if(ownerType === 'circle' && !circles.some(x => x.uid === ownerId)) {
            setOwnerType('user');
            setOwnerId(profile.uid);
        }
    }, [circles, ownerType, ownerId, profile.uid])

    //auto focus when task is created
    useEffect(() => {
        if(autoFocus && titleInputRef.current) {
            titleInputRef.current.focus();
            const valueLength = titleInputRef.current.value.length;
            titleInputRef.current.setSelectionRange(valueLength, valueLength);
        }
    }, [autoFocus]);

    // board tab task
    if(variant === 'board') {
        return (
            <div className="flex flex-col gap-3 p-4 text-sm text-text1 group border-2 border-neutral4 rounded-xl bg-background0">
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
                    <DueDateInput dueAt={dueAt} setDueAt={setDueAt}/>

                    <CircleInput
                        userId={profile.uid}
                        ownerType={ownerType}
                        ownerId={ownerId}
                        setOwnerType={setOwnerType}
                        setOwnerId={setOwnerId}
                        circles={circles}
                    />

                </div>

            </div>
        )
    }

    // doc-like agenda list task
    if(variant === 'doc') {
        const isCompleted = status === 'Completed';

        const handleToggleComplete = () => {
            setStatus(isCompleted ? 'Incomplete' : 'Completed');
        }

        return (
            <div className={`group flex items-center gap-2 text-sm ${isCompleted ? 'text-text2' : 'text-text1'}`}>
                <button
                    onClick={handleToggleComplete}
                    className={`group/check shrink-0 flex h-4 w-4 items-center justify-center rounded-[3px] border bg-transparent cursor-pointer transition-all  ${
                        isCompleted
                            ? 'opacity-100 border-neutral2'
                            : 'opacity-0 border-transparent group-hover:opacity-100 group-hover:border-neutral2 hover:border-neutral3'
                    }`}
                >
                    <FaCheck
                        className={`text-[10px] ${
                            isCompleted
                                ? 'opacity-100 text-neutral0'
                                : 'opacity-0 text-neutral2 group-hover/check:opacity-100'
                        }`}
                    />
                </button>

                <TitleInput
                    titleInput={titleInput}
                    setTitleInput={setTitleInput}
                    setTitle={setTitle}
                    inputRef={titleInputRef}
                    taskId={task.uid}
                    setNewTaskId={setNewTaskId}
                    variant={variant}
                    placeholder=''
                    classNameOverride={`${isCompleted ? 'line-through text-neutral1' : 'text-neutral0'}`}
                    onDeleteEmpty={onDeleteEmpty}
                    onEnter={onEnter}
                />
            </div>
        )
    }

    // default list tab task
    if(variant === 'list') {
        return (
            <div className="relative flex justify-between items-center gap-4 p-1 text-sm font-semibold text-text1 border-t-2 border-neutral4 group">
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
                    <DueDateInput dueAt={dueAt} setDueAt={setDueAt}/>
                </div>

                <div className="flex-1 min-w-0">
                    <CircleInput
                        userId={profile.uid}
                        ownerType={ownerType}
                        ownerId={ownerId}
                        setOwnerType={setOwnerType}
                        setOwnerId={setOwnerId}
                        circles={circles}
                    />
                </div>

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
                    <div className={`p-2 rounded-xl ${isOpen && "bg-background5"} hover:bg-background5 transition-colors `}>
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

const TitleInput = ( { titleInput, setTitleInput, setTitle, inputRef, taskId, setNewTaskId, variant, placeholder = 'Title', classNameOverride = '', onDeleteEmpty = null, onEnter = null } ) => {

    const handleBlur = () => {
        if(titleInput === '') {
            deleteTask(taskId);
        } else {
            setTitle(titleInput);
        }
        if(setNewTaskId) {
            setNewTaskId(-1);
        }
    };

    const getStyle = () => {
        if(variant === 'board') {
            return `text-left w-full p-2 focus:outline-none text-wrap`;
        } else if(variant === 'list') {
            return `text-left w-full p-2 focus:outline-none overflow-ellipsis`;
        } else if(variant === 'doc') {
            return `text-left w-full bg-transparent focus:outline-none`;
        }
        return '';
    }

    return (

        <input
            ref={inputRef}
            type="text"
            value={titleInput}
            placeholder={placeholder}
            onChange={(e) => {
                setTitleInput(e.target.value);
            }}
            onKeyUp={(e) => {
                if(e.key === 'Enter' && variant !== 'doc') {
                    e.target.blur()
                }
            }}
            onKeyDown={async (e) => {
                if(variant === 'doc' && e.key === 'Enter') {
                    e.preventDefault();
                    await onEnter?.();
                    return;
                }

                if(variant === 'doc' && e.key === 'Backspace' && titleInput === '' && onDeleteEmpty) {
                    e.preventDefault();
                    await onDeleteEmpty();
                }
            }}
            className={`${getStyle()} ${classNameOverride} ${variant === 'doc' ? 'placeholder:text-text2' : ''}`}
            onBlur={handleBlur}
        ></input>

    )
}

const DueDateInput = ( { dueAt, setDueAt } ) => {

    const onSelectDate = (date) => {
        setDueAt(date !== -1 ? { seconds: Math.floor(date.getTime() / 1000) } : -1);
    }

    return (

        <DatePicker
            onSelect={onSelectDate}
            selectedDate={dueAt}
            className="justify-self-start self-start max-w-full"
        >
            {(isOpen) =>
                <button className="w-full flex items-center bg-background3 rounded-xl cursor-pointer">
                    <div className={`flex items-center gap-2 p-2 rounded-xl ${isOpen && "bg-background5"} hover:bg-background5 transition-colors `}>
                        <FaCalendar className={dueAt !== -1 ? 'text-text1' : 'text-text2'}/>
                        {dueAt !== -1 && (
                            <h1 className={`text-xs ${dueAt.seconds * 1000 < Date.now() && 'text-red-400'}`}>
                                {formatDateFromSeconds(dueAt.seconds)}
                            </h1>
                        )}
                    </div>
                </button>
            }
        </DatePicker>


    )

}

const CircleInput = ( { userId, ownerType, ownerId, circles, setOwnerType, setOwnerId } ) => {

    const getCircle = () => {
        const foundCircle = circles.find(x => x.uid === ownerId);
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
        if(option.uid === null) {
            setOwnerType('user')
            setOwnerId(userId)
            return
        }

        setOwnerType('circle')
        setOwnerId(option.uid)
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
                    <div className={`flex min-w-0 items-center gap-2 p-2 rounded-xl ${isOpen && "bg-background5"} hover:bg-background5 transition-colors `}>
                        <FaUserFriends className={ownerType === 'circle' ? 'text-text1' : 'text-text2'}/>
                        {ownerType === 'circle' && (
                            <h1 className="text-xs max-w-full truncate">{getCircle().title}</h1>
                        )}
                    </div>

                </button>
            }
        </Dropdown>
    )

}

export default Task