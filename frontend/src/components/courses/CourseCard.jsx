import { MdDeleteOutline, MdMenuBook } from 'react-icons/md'
import Card from '../main/Card'
import { FaBook } from 'react-icons/fa6'

const CourseCard = ({ course, onRemove, loading = false }) => {
    return (
        <Card>
            <div className='h-28 rounded-xl bg-neutral5 flex items-center justify-center text-neutral2'>
                <FaBook className='text-4xl' />
            </div>

            <div className='flex flex-col gap-1'>
                <p className='font-semibold text-neutral0 truncate'>{course.title}</p>
                <p className='text-sm text-neutral1 truncate'>{course.subject} • {course.courseId}</p>
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

export default CourseCard