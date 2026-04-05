import { MdDeleteOutline } from 'react-icons/md'
import Card from '../main/Card'
import { FaBook } from 'react-icons/fa6'
import { FaChalkboardTeacher } from 'react-icons/fa'
import { SUBJECT_ICONS } from '../../utils/courseUtils'

const MyCoursesCard = ({
    course,
    customization,
    teacherName,
    onRemove,
    loading = false,
    teacherLoading = false
}) => {

    const bgColor = customization?.bgColor ?? '#f3f4f6'
    const iconColor = customization?.iconColor ?? '#9ca3af'
    const SubjectIcon = SUBJECT_ICONS[course.subject];

    return (
        <Card>
            <div className='w-full text-left'>
                <div
                    className={`h-28 rounded-xl flex items-center justify-center text-neutral2 ${loading ? 'animate-pulse' : ''}`}
                    style={{ backgroundColor: bgColor }}
                >
                    <FaBook className='text-4xl' style={{ color: iconColor }} />
                </div>

                <div className='mt-4 flex flex-col gap-1'>
                    <p className={`font-semibold text-neutral0 truncate ${loading ? 'opacity-70' : ''}`}>{course.title}</p>
                    <p className='text-xs text-neutral1 truncate flex items-center gap-2'>
                        <SubjectIcon/>
                        {course.subject}
                    </p>
                    {teacherLoading ? (
                        <div className='h-3.5 w-32 rounded bg-neutral5 animate-pulse mt-0.5' />
                    ) : teacherName && (
                        <p className='text-xs text-neutral1 truncate flex items-center gap-2'>
                            <FaChalkboardTeacher/> {teacherName}
                        </p>
                    )}
                </div>
            </div>
            
            <div className='flex justify-end'>
                <button
                    onClick={onRemove}
                    disabled={loading}
                    className='p-2 rounded-lg text-neutral1 hover:bg-neutral5 hover:text-red-500 transition-colors  cursor-pointer disabled:cursor-not-allowed'
                    aria-label={`Remove ${course.title}`}
                >
                    <MdDeleteOutline className='text-xl' />
                </button>
            </div>

        </Card>
    )
}

export default MyCoursesCard