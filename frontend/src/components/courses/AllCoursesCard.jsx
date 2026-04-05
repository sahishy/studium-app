import { FaBook, FaThumbsUp } from 'react-icons/fa6'
import Card from '../main/Card'
import { formatScoreLabel } from '../../utils/reviewUtils'
import { SUBJECT_ICONS } from '../../utils/courseUtils';

const AllCoursesCard = ({ course, score, onOpen }) => {

    const SubjectIcon = SUBJECT_ICONS[course.subject];

    return (
        <button onClick={onOpen} className='w-full text-left'>
            <Card hoverable className='h-full'>
                <div className='h-24 rounded-xl bg-neutral5 flex items-center justify-center text-neutral2'>
                    <SubjectIcon className='text-3xl' />
                </div>

                <div className='flex flex-col gap-3 min-w-0'>
                    <div>
                        <p className='font-semibold text-neutral0 truncate'>{course.title}</p>
                        <p className='text-xs text-neutral1 truncate flex items-center gap-1'>
                            <span>{course.subject}</span>
                            <span>•</span>
                            <span className='inline-flex items-center gap-1'>
                                {score != null && <FaThumbsUp />}
                                {formatScoreLabel(score)}
                            </span>
                        </p>
                    </div>

                    <p className='text-xs text-neutral1 overflow-hidden line-clamp-3'>
                        {course.description || 'No description available.'}
                    </p>
                </div>
            </Card>
        </button>
    )

}

export default AllCoursesCard