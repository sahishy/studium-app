import Card from '../../../shared/components/ui/Card'
import { getSchoolNameById, SCORE_OPTIONS } from '../utils/reviewUtils'
import AvatarPicture from '../../../shared/components/avatar/AvatarPicture';
import { FaSchool } from 'react-icons/fa6';
import { FaChalkboardTeacher, FaEdit } from 'react-icons/fa';
import { MdDeleteOutline } from 'react-icons/md';

const CourseReviewCard = ({ review, reviewer, teacherName }) => {

    const score = review?.score;
    const schoolName = getSchoolNameById(review?.schoolId)

    const scoreOption = SCORE_OPTIONS.find(x => x.value === score);
    const scoreName = scoreOption.label;
    const ScoreIcon = scoreOption.icon;

    return (
        <div className='group relative flex flex-col gap-6'>

            <div className='absolute right-6 top-6 hidden group-hover:flex gap-3 text-neutral1 z-1'>
                <button className='cursor-pointer'>
                    <FaEdit className='text-sm' />
                </button>
                <button className='cursor-pointer'>
                    <MdDeleteOutline className='text-lg' />
                </button>
            </div>

            <div className='relative bg-neutral5 rounded-4xl p-6 flex flex-col gap-3'>
                <div className='text-sm font-semibold text-neutral1 flex items-center gap-2'>
                    <ScoreIcon /> Rated {scoreName}
                </div>
                <p className='text-sm'>{review.review || 'Loading...'}</p>

                <ChatBubbleSwoosh className={'absolute w-8 -bottom-33 left-16 dark:hidden'} color='#F3F4F6'/>
                <ChatBubbleSwoosh className={'absolute w-8 -bottom-33 left-16 hidden dark:flex'} color='#1c1c21'/>
            </div>

            <div className='flex gap-3 items-center'>

                <AvatarPicture
                    profile={reviewer}
                    className='w-20 h-20'
                />

                <div className='flex flex-col gap-1'>
                    <p className='font-semibold text-neutral0'>
                        {reviewer?.profile?.displayName || 'Loading...'}
                    </p>
                    <p className='text-xs text-neutral1 flex items-center gap-2'>
                        <FaSchool /> Attends {(schoolName ? `${schoolName} High School` : 'an unknown high school')}
                    </p>
                    <p className='text-xs text-neutral1 flex items-center gap-2'>
                        <FaChalkboardTeacher /> Taught by {teacherName || 'Unknown teacher'}
                    </p>

                </div>

            </div>

        </div >
    )
}

const ChatBubbleSwoosh = ( { className, color } ) => {

    return (
        <svg className={className} width="256" height="256" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M254.726 40C242.448 115.213 182.024 212.274 1.81055 216.371C46.3089 143.774 64.0192 85.2407 67 40H254.726Z" fill={color} />
        </svg>
    )

}

export default CourseReviewCard