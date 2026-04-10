import Card from '../../../shared/components/ui/Card'
import { getSchoolNameById, SCORE_OPTIONS } from '../utils/reviewUtils'
import AvatarPicture from '../../../shared/components/avatar/AvatarPicture';
import { FaSchool } from 'react-icons/fa6';
import { FaChalkboardTeacher, FaEdit } from 'react-icons/fa';
import Button from '../../../shared/components/ui/Button';
import { MdDeleteOutline } from 'react-icons/md';
import { BiEdit } from 'react-icons/bi';

const CourseReviewCard = ({ review, reviewer, teacherName }) => {

    const score = review?.score;
    const schoolName = getSchoolNameById(review?.schoolId)

    const scoreOption = SCORE_OPTIONS.find(x => x.value === score);
    const scoreName = scoreOption.label;
    const ScoreIcon = scoreOption.icon;

    return (
        <Card className='group gap-3'>

            <div className='absolute right-4 hidden group-hover:flex gap-3 text-neutral1'>
                <button className='cursor-pointer'>
                    <FaEdit className='text-sm'/>
                </button>
                <button className='cursor-pointer'>
                    <MdDeleteOutline className='text-lg'/>
                </button>
            </div>

            <div className='flex gap-3 items-center'>

                <AvatarPicture
                    profile={reviewer}
                    className='w-20 h-20'
                />

                <div className='flex flex-col gap-1'>
                    <p className='font-semibold text-neutral0'>
                        {reviewer?.profile?.displayName || 'Anonymous'}
                    </p>
                    <p className='text-xs text-neutral1 flex items-center gap-2'>
                        <FaSchool /> Attends {(schoolName ? `${schoolName} High School` : 'an unknown high school')}
                    </p>
                    <p className='text-xs text-neutral1 flex items-center gap-2'>
                        <FaChalkboardTeacher /> Taught by {teacherName || 'Unknown teacher'}
                    </p>
                    <div className='text-xs text-neutral1 flex items-center gap-2'>
                        <ScoreIcon /> Rated {scoreName}
                    </div>
                </div>

            </div>

            <p className='text-sm text-neutral1 whitespace-pre-wrap'>
                {review?.review || 'Error loading review.'}
            </p>

        </Card>
    )
}

export default CourseReviewCard