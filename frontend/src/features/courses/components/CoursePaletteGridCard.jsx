import { FaBook, FaThumbsUp } from 'react-icons/fa6'
import Card from '../../../shared/components/ui/Card'
import { formatScoreLabel } from '../utils/reviewUtils'
import { SUBJECT_ICONS } from '../utils/courseUtils';

const CoursePaletteGridCard = ({ course, onAdd, loading, isTaking, score = null }) => {

    const SubjectIcon = SUBJECT_ICONS[course.subject];

    return (
        <button
            onClick={onAdd}
            disabled={loading || isTaking}
            className='cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'
        >
            <Card hoverable className={'text-start p-2! gap-1! h-full'}>
                <div className='h-24 bg-neutral5 flex items-center justify-center text-neutral2 rounded-lg'>
                    <SubjectIcon className='text-3xl' />
                </div>
                <div className='p-2 flex flex-col gap-2 min-h-0'>
                    <div>
                        <p className='text-sm font-semibold text-neutral0 truncate'>{course.title}</p>
                        <p className='text-xs text-neutral1 truncate flex items-center gap-1'>
                            <span>{course.subject}</span>
                            <span>•</span>
                            {score == null ? (
                                <span>No Reviews</span>
                            ) : (
                                <span className='inline-flex items-center gap-1'>
                                    <FaThumbsUp/>
                                    {formatScoreLabel(score)}
                                </span>
                            )}
                        </p>
                    </div>
                    <p className='text-xs text-neutral1 overflow-hidden line-clamp-5'>
                        {course.description || 'No description available.'}
                    </p>
                </div>
            </Card>
        </button>
    )
}

export default CoursePaletteGridCard