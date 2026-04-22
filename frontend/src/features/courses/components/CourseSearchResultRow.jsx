import { FaThumbsUp } from 'react-icons/fa6'
import { formatScoreLabel } from '../utils/reviewUtils'
import Card from '../../../shared/components/ui/Card'
import { SUBJECT_ICONS } from '../utils/courseUtils';

const CourseSearchResultRow = ({ course, onAdd, loading, isTaking, score = null }) => {

    const SubjectIcon = SUBJECT_ICONS[course.subject];

    return (
        <button
            onClick={onAdd}
            disabled={loading || isTaking}
            className='disabled:opacity-40 disabled:cursor-not-allowed'
        >
            <Card
                hoverable={!isTaking}
                className='w-full flex flex-row items-center'
            >

                <div className='w-12 h-12 rounded-lg flex items-center justify-center bg-neutral5 text-neutral2 shrink-0'>
                    <SubjectIcon className='text-xl' />
                </div>

                <div className='min-w-0 flex-1 flex flex-col gap-1'>
                    <div className='text-start'>
                        <p className='text-sm font-semibold text-neutral0 truncate'>{course.title}</p>
                        <p className='text-xs text-neutral1 truncate flex items-center gap-1'>
                            {course.subject} •
                            <span className='flex gap-1 items-center'>
                                {score != null && <FaThumbsUp />}
                                {formatScoreLabel(score)}
                            </span>
                        </p>
                    </div>
                    <p className='text-xs text-neutral1 truncate'>
                        {course.description || 'No description'}
                    </p>
                </div>

            </Card>
        </button >
    )
}

export default CourseSearchResultRow