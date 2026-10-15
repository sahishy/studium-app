import { SCORE_OPTIONS } from '../utils/reviewUtils'
import AuthorIdentity from '../../profile/components/AuthorIdentity'
import HeartButton from '../../../shared/components/ui/HeartButton'
import { useOutletContext } from 'react-router-dom'
import { useReviewHeart } from '../services/reviewHeartService'
import { getCourseById } from '../services/courseService'
import { FaBook } from 'react-icons/fa6';
import { FaEdit } from 'react-icons/fa';
import { MdDelete } from 'react-icons/md';

const CourseReviewCard = ({ review, reviewer, showCourse = false, canManage = false, onEdit, onDelete, deleting = false }) => {

    const score = review?.score;
    const { profile } = useOutletContext()
    const heart = useReviewHeart(review?.uid, profile?.uid)
    const course = showCourse ? getCourseById(review?.courseId) : null

    const scoreOption = SCORE_OPTIONS.find(x => Number(x.value) === Number(score)) ?? SCORE_OPTIONS.find((x) => Number(x.value) === 0.5);
    const scoreName = scoreOption?.label ?? 'Okay';
    const ScoreIcon = scoreOption?.icon;

    return (
        <div className='group relative flex min-w-0 flex-col gap-6'>

            {canManage ? (
                <div className='absolute right-6 top-6 hidden group-hover:flex gap-3 text-neutral1 z-1'>
                    <button aria-label='Edit review' className='cursor-pointer hover:text-neutral0 transition' type='button' onClick={onEdit}>
                        <FaEdit className='text-sm' />
                    </button>
                    <button aria-label='Delete review' className='cursor-pointer hover:text-neutral0 transition disabled:opacity-50 disabled:cursor-not-allowed' type='button' onClick={onDelete} disabled={deleting}>
                        <MdDelete className='text-lg' />
                    </button>
                </div>
            ) : null}

            <div className='relative bg-neutral5 rounded-4xl p-6 flex flex-1 flex-col gap-3'>
                {course ? <p className='text-xs text-neutral1 flex items-start gap-2'>
                    <FaBook className='shrink-0 mt-0.5' /> <span>{course.title}</span>
                </p> : null}
                <p className='text-sm whitespace-pre-wrap break-words'>{review.review || 'Loading...'}</p>
                <div className='flex justify-between translate-y-2'>
                    <div className='text-sm font-semibold text-neutral1 flex items-center gap-2'>
                        {ScoreIcon ? <ScoreIcon /> : null} Rated {scoreName}
                    </div>
                    <HeartButton active={heart.active} count={heart.count} disabled={heart.loading || heart.pending || deleting || !profile?.uid} onClick={heart.toggle} label='review' />
                </div>
                {heart.error ? <p role='alert' className='text-xs text-red-400'>{heart.error}</p> : null}

                <ChatBubbleSwoosh className={'absolute w-8 -bottom-33 left-16 dark:hidden'} color='#F3F4F6' />
                <ChatBubbleSwoosh className={'absolute w-8 -bottom-33 left-16 hidden dark:flex'} color='#1c1c21' />
            </div>

            <AuthorIdentity author={reviewer} />

        </div >
    )
}

const ChatBubbleSwoosh = ({ className, color }) => {

    return (
        <svg className={className} width="256" height="256" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M254.726 40C242.448 115.213 182.024 212.274 1.81055 216.371C46.3089 143.774 64.0192 85.2407 67 40H254.726Z" fill={color} />
        </svg>
    )

}

export default CourseReviewCard
