import { useEffect, useMemo, useState } from 'react'
import { useOutletContext, useParams } from 'react-router-dom'
import { FaBook, FaHandshake, FaThumbsDown, FaThumbsUp } from 'react-icons/fa6'
import Button from '../../components/main/Button'
import CourseReviewCard from '../../components/courses/CourseReviewCard'
import { useCourseReviews, upsertCourseReview, getUsersByIdsMap } from '../../services/reviewService'
import { getTeachersByIdsMap } from '../../services/teacherService'
import { getCourseById } from '../../services/courseService'
import { useUserStats } from '../../contexts/UserStatsContext'
import { SCORE_OPTIONS, sortReviewsBySchoolPriority } from '../../utils/reviewUtils'
import { useCourses } from '../../contexts/CoursesContext'
import Card from '../../components/main/Card'
import { getEffectiveSchoolIds } from '../../services/schoolService'

const CourseOverview = () => {

    const { courseId } = useParams()
    const { profile } = useOutletContext()
    const { userStats } = useUserStats()
    const { enrollments = [] } = useCourses()

    const course = getCourseById(courseId)
    const reviews = useCourseReviews(courseId)
    const [reviewText, setReviewText] = useState('')
    const [score, setScore] = useState(1)
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
            schoolId: userStats?.schoolId ?? null,
            schoolAffiliations: userStats?.schoolAffiliations ?? [],
        })

        return sortReviewsBySchoolPriority(reviews, effectiveSchoolIds)
    }, [reviews, userStats?.schoolId, userStats?.schoolAffiliations])

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
                schoolId: userStats?.schoolId ?? null,
                teacherId: myEnrollment?.teacherId ?? null,
                review: reviewText,
                score,
            })

            setReviewText('')
            setScore(1)
        } finally {
            setIsSubmitting(false)
        }
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

                <form onSubmit={handleSubmitReview} className='rounded-xl border border-neutral4 bg-neutral6 p-4 flex flex-col gap-3'>
                    <h3 className='font-semibold text-neutral0'>Add a review</h3>

                    <div className='flex gap-2'>
                        {SCORE_OPTIONS.map((option) => {
                            const Icon = option.icon
                            return (
                                <button
                                    key={option.value}
                                    type='button'
                                    onClick={() => setScore(option.value)}
                                    className={`px-3 py-2 rounded-lg border text-sm flex items-center gap-2 cursor-pointer ${score === option.value
                                        ? 'border-neutral0 text-neutral0 bg-neutral5'
                                        : 'border-neutral4 text-neutral1 hover:bg-neutral5'
                                        }`}
                                >
                                    <Icon />
                                    {option.label}
                                </button>
                            )
                        })}
                    </div>

                    <textarea
                        value={reviewText}
                        onChange={(event) => setReviewText(event.target.value)}
                        rows={4}
                        placeholder='Share your experience...'
                        className='w-full rounded-xl border border-neutral4 p-3 text-sm text-neutral0 bg-transparent focus:outline-none'
                    />

                    <div className='flex justify-end'>
                        <Button type='secondary' htmlType='submit' disabled={isSubmitting}>
                            {isSubmitting ? 'Posting...' : 'Post Review'}
                        </Button>
                    </div>
                </form>

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