import { useEffect, useMemo, useState } from 'react'
import { useOutletContext, useParams } from 'react-router-dom'
import { FaBook, FaHandshake, FaThumbsDown, FaThumbsUp } from 'react-icons/fa6'
import Button from '../../../shared/components/ui/Button'
import CourseReviewCard from '../components/CourseReviewCard'
import { useCourseReviews, upsertCourseReview, getUsersByIdsMap } from '../services/reviewService'
import { getTeachersByIdsMap } from '../services/teacherService'
import { getCourseById } from '../services/courseService'
import { useUserStats } from '../../profile/contexts/UserStatsContext'
import { SCORE_OPTIONS, sortReviewsBySchoolPriority } from '../utils/reviewUtils'
import { useCourses } from '../contexts/CoursesContext'
import Card from '../../../shared/components/ui/Card'
import { getEffectiveSchoolIds } from '../../profile/services/schoolService'

const CourseOverview = () => {

    const { courseId } = useParams()
    const { profile } = useOutletContext()
    const { userStats } = useUserStats()
    const { enrollments = [] } = useCourses()

    const course = getCourseById(courseId)
    const reviews = useCourseReviews(courseId)
    const [reviewText, setReviewText] = useState('')
    const [score, setScore] = useState(1)
    const [isReviewComposerOpen, setIsReviewComposerOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [usersMap, setUsersMap] = useState({})
    const [teachersMap, setTeachersMap] = useState({})

    const myEnrollment = useMemo(() => {
        return enrollments.find((entry) => String(entry.courseId) === String(courseId)) ?? null
    }, [enrollments, courseId])

    useEffect(() => {
        const loadMaps = async () => {
            const uniqueUserIds = Array.from(new Set(reviews.map((review) => String(review.userId))))
            const uniqueTeacherIds = Array.from(new Set(reviews.map((review) => String(review.teacherId)).filter(Boolean)))

            const [nextUsers, nextTeachers] = await Promise.all([
                getUsersByIdsMap(uniqueUserIds),
                getTeachersByIdsMap(uniqueTeacherIds),
            ])

            setUsersMap(nextUsers)
            setTeachersMap(nextTeachers)
        }

        loadMaps()
    }, [reviews])

    const sortedReviews = useMemo(() => {
        const effectiveSchoolIds = getEffectiveSchoolIds({
            schoolId: userStats?.academic?.schoolId ?? null,
            schoolAffiliations: userStats?.academic?.schoolAffiliations ?? [],
        })

        return sortReviewsBySchoolPriority(reviews, effectiveSchoolIds)
    }, [reviews, userStats?.academic?.schoolId, userStats?.academic?.schoolAffiliations])

    const handleSubmitReview = async (event) => {
        event.preventDefault()
        if (!profile?.uid || !courseId) {
            return
        }

        setIsSubmitting(true)
        try {
            await upsertCourseReview({
                courseId,
                userId: profile.uid,
                schoolId: userStats?.academic?.schoolId ?? null,
                teacherId: myEnrollment?.teacherId ?? null,
                review: reviewText,
                score,
            })

            setReviewText('')
            setScore(1)
            setIsReviewComposerOpen(false)
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleCancelReview = () => {
        setReviewText('')
        setScore(1)
        setIsReviewComposerOpen(false)
    }

    if (!course) {
        return <p className='text-sm text-neutral1'>Course not found.</p>
    }

    return (
        <div className='w-full flex flex-col gap-6 pb-12'>

            <Card className={'p-0! overflow-hidden gap-0!'}>
                <div className='p-6 w-full h-48 bg-neutral5 flex items-center justify-center'>
                    <FaBook className='text-neutral3 text-8xl' />
                </div>
                <div className='p-6'>
                    <div>
                        <h2 className='text-xl font-semibold text-neutral0'>{course.title}</h2>
                        <p className='text-sm text-neutral1'>{course.subject}</p>
                    </div>
                    <p className='text-sm text-neutral1 mt-2'>{course.description || 'No description available.'}</p>
                </div>
            </Card>

            <section className='flex flex-col gap-3'>
                <h2 className='text-2xl font-semibold'>Reviews</h2>

                {isReviewComposerOpen ? (
                    <form onSubmit={handleSubmitReview} className='flex flex-col rounded-3xl overflow-hidden border border-neutral4'>

                        <textarea
                            value={reviewText}
                            onChange={(event) => setReviewText(event.target.value)}
                            rows={4}
                            placeholder='Share your experience...'
                            className='w-full px-4 py-3 text-sm text-neutral0 focus:outline-none'
                            autoFocus
                        />

                        <div className='flex justify-between p-3'>
                            <div className='flex gap-2'>
                                {SCORE_OPTIONS.map((option) => {
                                    const Icon = option.icon
                                    return (
                                        <button
                                            key={option.value}
                                            type='button'
                                            onClick={() => setScore(option.value)}
                                            className={`px-3 py-1 rounded-full border text-xs flex items-center gap-2 cursor-pointer transition
                                                 ${score === option.value
                                                    ? 'text-neutral6 bg-neutral0'
                                                    : 'border-neutral4 text-neutral1 hover:bg-neutral5'
                                                }`}
                                        >
                                            <Icon />
                                            {option.label}
                                        </button>
                                    )
                                })}
                            </div>
                            <div className='flex gap-3'>
                                <Button type='secondary' onClick={handleCancelReview} disabled={isSubmitting}>
                                    Cancel
                                </Button>
                                <Button type='primary' htmlType='submit' disabled={isSubmitting}>
                                    {isSubmitting ? 'Posting...' : 'Post Review'}
                                </Button>
                            </div>

                        </div>

                    </form>
                ) : (
                    <button
                        type='button'
                        onClick={() => setIsReviewComposerOpen(true)}
                        className='w-full text-left text-sm text-neutral1 rounded-full border border-neutral4 px-4 py-3 hover:bg-neutral5 transition-colors cursor-pointer'
                    >
                        Share your experience...
                    </button>
                )}

                <div className='grid grid-cols-2 gap-3'>
                    {sortedReviews.length === 0 ? (
                        <div className='col-span-2 flex flex-col items-center py-16'>
                            <p className='text-neutral0 font-semibold'>
                                Be the first to review
                            </p>
                            <p className='text-sm text-neutral1'>
                                Nobody has reviewed this course yet. Talk about your experience!
                            </p>
                        </div>
                    ) : (
                        sortedReviews.map((review) => {

                            const reviewer = usersMap[String(review.userId)]

                            return (
                                <CourseReviewCard
                                    key={review.uid}
                                    review={review}
                                    reviewer={reviewer}
                                    teacherName={teachersMap[String(review.teacherId)]?.name}
                                />
                            )

                        })
                    )}
                </div>
            </section>

        </div>
    )
}

export default CourseOverview