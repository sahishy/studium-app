import { FaCalendar, FaCheckCircle, FaClock, FaDotCircle, FaUserFriends } from 'react-icons/fa'
import DatePicker from '../../../shared/components/popovers/DatePicker'
import Select from '../../../shared/components/popovers/Select'
import { formatDateFromSeconds } from '../../../shared/utils/formatters'

const STATUS_OPTIONS = [
    { label: 'Incomplete', icon: <FaDotCircle className='text-sm' /> },
    { label: 'In Progress', icon: <FaClock className='text-yellow-400 text-sm' /> },
    { label: 'Completed', icon: <FaCheckCircle className='text-emerald-400 text-sm' /> },
]

const DefaultStatusTrigger = ({ isOpen, status }) => (
    <button className='flex items-center bg-background3 rounded-xl cursor-pointer'>
        <div className={`p-2 rounded-xl ${isOpen ? 'bg-background5' : ''} hover:bg-background5 transition-colors`}>
            {status === 'Incomplete' ? (
                <FaDotCircle className='text-text1' />
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

const DefaultDueDateTrigger = ({ isOpen, dueAt, isOverdue }) => (
    <button className='w-full flex items-center bg-background3 rounded-xl cursor-pointer'>
        <div className={`flex items-center gap-2 p-2 rounded-xl ${isOpen ? 'bg-background5' : ''} hover:bg-background5 transition-colors`}>
            <FaCalendar className={dueAt !== -1 ? 'text-text1' : 'text-text2'} />
            {dueAt !== -1 && (
                <h1 className={`text-xs ${isOverdue ? 'text-red-400' : ''}`}>
                    {formatDateFromSeconds(dueAt.seconds)}
                </h1>
            )}
        </div>
    </button>
)

export const TaskDueDateInput = ({ dueAt, setDueAt, className = '', renderTrigger }) => {
    const onSelectDate = (date) => {
        setDueAt(date !== -1 ? { seconds: Math.floor(date.getTime() / 1000) } : -1)
    }

    const isOverdue = dueAt !== -1 && dueAt?.seconds * 1000 < Date.now()

    return (
        <DatePicker onSelect={onSelectDate} selectedDate={dueAt} className={className}>
            {(isOpen) =>
                renderTrigger
                    ? renderTrigger({
                        isOpen,
                        dueAt,
                        isSet: dueAt !== -1,
                        isOverdue,
                        formattedDate: dueAt !== -1 ? formatDateFromSeconds(dueAt.seconds) : '',
                    })
                    : <DefaultDueDateTrigger isOpen={isOpen} dueAt={dueAt} isOverdue={isOverdue} />
            }
        </DatePicker>
    )
}

const DefaultCircleTrigger = ({ isOpen, ownerType, selectedCircle }) => (
    <button className='w-full flex min-w-0 items-center bg-background3 rounded-xl cursor-pointer'>
        <div className={`flex min-w-0 items-center gap-2 p-2 rounded-xl ${isOpen ? 'bg-background5' : ''} hover:bg-background5 transition-colors`}>
            <FaUserFriends className={ownerType === 'circle' ? 'text-text1' : 'text-text2'} />
            {ownerType === 'circle' && <h1 className='text-xs max-w-full truncate'>{selectedCircle.title}</h1>}
        </div>
    </button>
)

export const TaskCircleInput = ({
    userId,
    ownerType,
    ownerId,
    circles,
    setOwnerType,
    setOwnerId,
    className = '',
    renderTrigger,
}) => {
    const truncateOption = (s) => (s.length <= 25 ? s : `${s.substring(0, 25)}...`)

    const selectedCircle = circles.find((x) => x.uid === ownerId) ?? { title: 'Unknown' }

    const options = [
        { uid: null, label: <h1 className='text-text2'>None</h1>, icon: null },
        ...circles.map((circle) => ({ uid: circle.uid, label: truncateOption(circle.title), icon: <FaUserFriends /> })),
    ]

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
        <Select
            options={options}
            onSelect={handleSelectOption}
            className={className}
            isOptionSelected={(option) => {
                if(option.uid === null) return ownerType !== 'circle'
                return ownerType === 'circle' && String(option.uid) === String(ownerId)
            }}
        >
            {(isOpen) =>
                renderTrigger
                    ? renderTrigger({ isOpen, ownerType, ownerId, selectedCircle })
                    : <DefaultCircleTrigger isOpen={isOpen} ownerType={ownerType} selectedCircle={selectedCircle} />
            }
        </Select>
    )
}
