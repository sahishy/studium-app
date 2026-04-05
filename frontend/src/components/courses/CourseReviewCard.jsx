import Card from '../main/Card'
import { getSchoolNameById } from '../../utils/reviewUtils'

const scoreNames = {
    '1': 'Good',
    '0.5': 'Okay',
    '0': 'Bad'
}

const CourseReviewCard = ({ review, reviewerName, teacherName }) => {

    const score = review?.score;
    const schoolName = getSchoolNameById(review?.schoolId)

    return (
        <Card className='gap-3'>

            <div className='flex flex-col gap-1'>
                <p className='text-sm font-semibold text-neutral0'>{reviewerName || 'Anonymous'}</p>

                <div className='flex gap-1'>
                    <span className='inline-flex items-center rounded-full bg-neutral5 px-2 py-0.5 text-[10px] text-neutral1'>
                        {score ? `${scoreNames[score]}` : 'No Rating'}
                    </span>
                    <span className='inline-flex items-center rounded-full bg-neutral5 px-2 py-0.5 text-[10px] text-neutral1'>
                        {(schoolName ? `${schoolName} High School` : 'Unknown High School')}
                    </span>
                    <span className='inline-flex w-fit items-center rounded-full bg-neutral5 px-2 py-0.5 text-[10px] text-neutral1'>
                        Taught by {teacherName || 'Unknown teacher'}
                    </span>
                </div>
            </div>

            <p className='text-sm text-neutral1 whitespace-pre-wrap'>
                {review?.review || 'Error loading review.'}
            </p>

        </Card>
    )
}

export default CourseReviewCard