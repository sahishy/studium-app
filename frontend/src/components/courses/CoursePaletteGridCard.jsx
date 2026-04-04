import { FaBook } from 'react-icons/fa6'
import Card from '../main/Card'

const CoursePaletteGridCard = ({ course, onAdd, loading, isTaking }) => {
    return (
        <button
            onClick={onAdd}
            disabled={loading || isTaking}
            className='overflow-hidden cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'
        >
            <Card hoverable className={'h-full text-start p-2! gap-1!'}>
                <div className='h-24 bg-neutral5 flex items-center justify-center text-neutral2 rounded-lg'>
                    <FaBook className='text-3xl' />
                </div>
                <div className='p-2 flex flex-col gap-2'>
                    <div>
                        <p className='text-sm font-semibold text-neutral0 truncate'>{course.title}</p>
                        <p className='text-xs text-neutral1 truncate'>{course.subject}</p>
                    </div>
                    <p className='text-xs text-neutral1'>
                        {course.description || 'No description available.'}
                    </p>
                </div>
            </Card>
        </button>
    )
}

export default CoursePaletteGridCard