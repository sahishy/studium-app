import { FaBook, FaCalendar, FaCheckCircle, FaClock, FaDotCircle, FaUserFriends } from 'react-icons/fa'
import DatePicker from '../../../shared/components/popovers/DatePicker'
import Select from '../../../shared/components/popovers/Select'
import { buildCircleOptions, buildCircleWidgetSegment, buildCourseOptions, buildCourseWidgetSegment, buildDateWidgetSegment, ensureTitleSetter, getCircleControlState, getCourseControlState, getDateControlState, removeWidget, upsertWidget } from '../utils/taskWidgetControlUtils'

const STATUS_OPTIONS = [
    { label: 'Incomplete', icon: <FaDotCircle className='text-sm' /> },
    { label: 'In Progress', icon: <FaClock className='text-yellow-400 text-sm' /> },
    { label: 'Completed', icon: <FaCheckCircle className='text-emerald-400 text-sm' /> },
]

const DefaultStatusTrigger = ({ isOpen, status }) => (
    <button className='flex items-center bg-neutral4 rounded-xl cursor-pointer'>
        <div className={`p-2 rounded-xl ${isOpen ? 'bg-neutral3' : ''} hover:bg-neutral3 transition-colors`}>
            {status === 'Incomplete' ? (
                <FaDotCircle className='text-neutral1' />
            ) : status === 'In Progress' ? (
                <FaClock className='text-yellow-400' />
            ) : (
                <FaCheckCircle className='text-emerald-400' />
            )}
        </div>
    </button>
)

export const TaskStatusInput = ({ status, setStatus, className = '', renderTrigger }) => {
    const handleSelectOption = (option) => setStatus(option.label)

    return (
        <Select
            options={STATUS_OPTIONS}
            onSelect={handleSelectOption}
            className={className}
            isOptionSelected={(option) => option.label === status}
        >
            {(isOpen) =>
                renderTrigger
                    ? renderTrigger({ isOpen, status, options: STATUS_OPTIONS })
                    : <DefaultStatusTrigger isOpen={isOpen} status={status} />
            }
        </Select>
    )
}

const DefaultDueDateTrigger = ({ isOpen, dueLabel, isSet, isOverdue }) => (
    <button className='w-full flex items-center bg-neutral4 rounded-xl cursor-pointer'>
        <div className={`flex items-center gap-2 p-2 rounded-xl ${isOpen ? 'bg-neutral3' : ''} hover:bg-neutral3 transition-colors`}>
            <FaCalendar className={isSet ? 'text-neutral1' : 'text-neutral2'} />
            {isSet && (
                <h1 className={`text-xs ${isOverdue ? 'text-red-400' : ''}`}>
                    {dueLabel}
                </h1>
            )}
        </div>
    </button>
)

export const TaskDueDateInput = ({ title, setTitle, className = '', renderTrigger }) => {
    const { selectedDate, dueLabel } = getDateControlState(title)

    const onSelectDate = (date) => {
        const apply = ensureTitleSetter(setTitle)
        if (date === -1) {
            apply((prev) => removeWidget({ title: prev, widgetType: 'date' }))
            return
        }

        apply((prev) => upsertWidget({
            title: prev,
            widgetType: 'date',
            builder: (existing) => buildDateWidgetSegment({ currentSegment: existing, date }),
        }))
    }

    const isSet = selectedDate !== -1
    const isOverdue = isSet && selectedDate?.seconds * 1000 < Date.now()

    return (
        <DatePicker onSelect={onSelectDate} selectedDate={selectedDate} className={className}>
            {(isOpen) =>
                renderTrigger
                    ? renderTrigger({
                        isOpen,
                        dueAt: selectedDate,
                        dueLabel,
                        isSet,
                        isOverdue,
                        formattedDate: dueLabel,
                    })
                    : <DefaultDueDateTrigger isOpen={isOpen} dueLabel={dueLabel} isSet={isSet} isOverdue={isOverdue} />
            }
        </DatePicker>
    )
}

const DefaultCircleTrigger = ({ isOpen, isSet, selectedCircle }) => (
    <button className='w-full flex min-w-0 items-center bg-neutral4 rounded-xl cursor-pointer'>
        <div className={`flex min-w-0 items-center gap-2 p-2 rounded-xl ${isOpen ? 'bg-neutral3' : ''} hover:bg-neutral3 transition-colors`}>
            <FaUserFriends className={isSet ? 'text-neutral1' : 'text-neutral2'} />
            {isSet && <h1 className='text-xs max-w-full truncate'>{selectedCircle.title}</h1>}
        </div>
    </button>
)

export const TaskCircleInput = ({
    userId,
    ownerType,
    ownerId,
    title,
    setTitle,
    circles,
    setOwnerType,
    setOwnerId,
    className = '',
    renderTrigger,
}) => {
    const { selectedCircleId, selectedCircle } = getCircleControlState({ title, circles, ownerType, ownerId })
    const options = buildCircleOptions(circles, { truncate: true }).map((option) => (
        option.uid === null
            ? { ...option, label: <h1 className='text-neutral2'>None</h1> }
            : { ...option, icon: <FaUserFriends /> }
    ))

    const handleSelectOption = (option) => {
        if (title !== undefined && setTitle) {
            const apply = ensureTitleSetter(setTitle)
            if(option.uid === null) {
                apply((prev) => removeWidget({ title: prev, widgetType: 'circle' }))
                setOwnerType?.('user')
                setOwnerId?.(userId)
                return
            }

            const resolvedTitle = circles.find((x) => String(x.uid) === String(option.uid))?.title || String(option.label || '')
            apply((prev) => upsertWidget({
                title: prev,
                widgetType: 'circle',
                builder: (existing) => buildCircleWidgetSegment({
                    currentSegment: existing,
                    circleId: option.uid,
                    circles,
                    fallbackLabel: resolvedTitle,
                }),
            }))
            setOwnerType?.('circle')
            setOwnerId?.(option.uid)
            return
        }

        if(option.uid === null) {
            setOwnerType('user')
            setOwnerId(userId)
            return
        }

        setOwnerType('circle')
        setOwnerId(option.uid)
    }

    return (
        <Select
            options={options}
            onSelect={handleSelectOption}
            className={className}
            isOptionSelected={(option) => {
                if(option.uid === null) return !selectedCircleId
                return String(option.uid) === String(selectedCircleId)
            }}
        >
            {(isOpen) =>
                renderTrigger
                    ? renderTrigger({ isOpen, ownerType, ownerId: selectedCircleId, selectedCircle })
                    : <DefaultCircleTrigger isOpen={isOpen} isSet={Boolean(selectedCircleId)} selectedCircle={selectedCircle} />
            }
        </Select>
    )
}

const DefaultCourseTrigger = ({ isOpen, isSet, selectedCourse }) => (
    <button className='w-full flex min-w-0 items-center bg-neutral4 rounded-xl cursor-pointer'>
        <div className={`flex min-w-0 items-center gap-2 p-2 rounded-xl ${isOpen ? 'bg-neutral3' : ''} hover:bg-neutral3 transition-colors`}>
            <FaBook className={isSet ? 'text-neutral1' : 'text-neutral2'} />
            {isSet && <h1 className='text-xs max-w-full truncate'>{selectedCourse.title}</h1>}
        </div>
    </button>
)

export const TaskCourseInput = ({ title, setTitle, courses = [], className = '', renderTrigger }) => {
    const { selectedCourseId, selectedCourse } = getCourseControlState({ title, courses })
    const options = buildCourseOptions(courses).map((option) => (
        option.uid === null
            ? { ...option, label: <h1 className='text-neutral2'>None</h1> }
            : { ...option, icon: <FaBook /> }
    ))

    const handleSelectOption = (option) => {
        const apply = ensureTitleSetter(setTitle)
        if (option.uid === null) {
            apply((prev) => removeWidget({ title: prev, widgetType: 'course' }))
            return
        }

        const course = courses.find((x) => String(x.courseId) === String(option.uid))
        const resolvedTitle = course?.title || String(option.label || '')
        apply((prev) => upsertWidget({
            title: prev,
            widgetType: 'course',
            builder: (existing) => buildCourseWidgetSegment({
                currentSegment: existing,
                courseId: String(option.uid),
                courses,
                fallbackLabel: resolvedTitle,
            }),
        }))
    }

    return (
        <Select
            options={options}
            onSelect={handleSelectOption}
            className={className}
            isOptionSelected={(option) => {
                if (option.uid === null) return !selectedCourseId
                return String(option.uid) === selectedCourseId
            }}
        >
            {(isOpen) =>
                renderTrigger
                    ? renderTrigger({ isOpen, selectedCourseId, selectedCourse })
                    : <DefaultCourseTrigger isOpen={isOpen} isSet={Boolean(selectedCourseId)} selectedCourse={selectedCourse} />
            }
        </Select>
    )
}
