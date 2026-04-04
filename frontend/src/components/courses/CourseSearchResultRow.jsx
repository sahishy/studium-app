import { FaBook } from 'react-icons/fa6'
import { MdMenuBook } from 'react-icons/md'

const CourseSearchResultRow = ({ course, onAdd, loading, isTaking }) => {
    return (
        <button
            onClick={onAdd}
            disabled={loading || isTaking}
            className='w-full text-left rounded-2xl border border-neutral3 bg-neutral6 hover:bg-neutral5 transition-colors  p-3 flex items-center gap-3 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'
        >
            <div className='w-12 h-12 rounded-lg flex items-center justify-center bg-neutral5 text-neutral2 shrink-0'>
                <FaBook className='text-xl'/>
            </div>
            <div className='min-w-0 flex-1'>
                <p className='text-sm font-semibold text-neutral0 truncate'>{course.title}</p>
                <p className='text-xs text-neutral1 truncate'>
                    {course.subject} • {course.courseId} • {course.description || 'No description'}
                </p>
            </div>
        </button>
    )
}

export default CourseSearchResultRow