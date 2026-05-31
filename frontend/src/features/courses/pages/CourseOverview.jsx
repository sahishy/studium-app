import { useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext, useParams } from 'react-router-dom'
import { FaArrowRightFromBracket, FaBook, FaBoxArchive, FaFaceFrown, FaFaceGrin, FaFaceMeh, FaFaceSmile, FaUserGroup } from 'react-icons/fa6'
import Button from '../../../shared/components/ui/Button'
import CourseReviewCard from '../components/CourseReviewCard'
import { getCourseReviews, upsertCourseReview, getUsersByIdsMap, deleteCourseReview, computeAverageScoreFromReviews } from '../services/reviewService'
import { getTeachersByIdsMap } from '../services/teacherService'
import { getCourseById, getStudentCountForCourse, leaveCourse } from '../services/courseService'
import { useUserStats } from '../../profile/contexts/UserStatsContext'
import { SCORE_OPTIONS, sortReviewsBySchoolPriority, formatScoreLabel } from '../utils/reviewUtils'
import { useCourses } from '../contexts/CoursesContext'
import Card from '../../../shared/components/ui/Card'
import { getEffectiveSchoolIds } from '../../profile/services/schoolService'
import ProgressBar from '../../../shared/components/ui/ProgressBar'
import AddCourseModal from '../components/modals/AddCourseModal'
import EditCourseModal from '../components/modals/EditCourseModal'
import { useModal } from '../../../shared/contexts/ModalContext'
import LoadingState from '../../../shared/components/ui/LoadingState'
import { MAX_USER_COURSES } from '../utils/courseUtils'
import { hexToRgba } from '../../../shared/utils/colorUtils'

const REVIEW_PAGE_SIZE = 9
const DEFAULT_SCORE = 0.9

const ratingDescriptions = [
    {
        score: 95,
        description: 'Amazing',
        icon: FaFaceGrin
    },
    {
        score: 80,
        description: 'Positive',
        icon: FaFaceSmile
    },
    {
        score: 50,
        description: 'Neutral',
        icon: FaFaceMeh
    },
    {
        score: 0,
        description: 'Negative',
        icon: FaFaceFrown
    },
]

const CourseOverview = () => {

    const { courseId } = useParams()
    const { profile } = useOutletContext()
    const { userStats } = useUserStats()
    const { enrollments = [], selectedCourses = [] } = useCourses()
    const { openModal, closeModal } = useModal()

    const course = getCourseById(courseId)
    const [reviews, setReviews] = useState([])
    const [reviewsLoading, setReviewsLoading] = useState(false)
    const [reviewsCursor, setReviewsCursor] = useState(null)
    const [hasMoreReviews, setHasMoreReviews] = useState(false)
    const [isLoadingMoreReviews, setIsLoadingMoreReviews] = useState(false)
    const [studentsTakingCount, setStudentsTakingCount] = useState(0)
    const [studentsTakingCountLoading, setStudentsTakingCountLoading] = useState(false)
    const [reviewText, setReviewText] = useState('')
    const [score, setScore] = useState(DEFAULT_SCORE)
    const [isReviewComposerOpen, setIsReviewComposerOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isDeletingReview, setIsDeletingReview] = useState(false)
    const [usersMap, setUsersMap] = useState({})
    const [teachersMap, setTeachersMap] = useState({})
    const reviewInputRef = useRef(null)

    const myEnrollment = useMemo(() => {
        return enrollments.find((entry) => String(entry.courseId) === String(courseId)) ?? null
    }, [enrollments, courseId])

    const isCourseLimitReached = selectedCourses.length >= MAX_USER_COURSES
    const enrolledCourseColor = myEnrollment?.customization?.color ?? '#9ca3af'
    const courseHeroBackground = myEnrollment ? hexToRgba(enrolledCourseColor, 0.2) : null

    useEffect(() => {
        let isCancelled = false

        const loadReviews = async () => {
            if (!courseId) {
                setReviews([])
                return
            }

            setReviewsLoading(true)
            try {
                const result = await getCourseReviews(courseId, { limitCount: REVIEW_PAGE_SIZE, cursor: null })
                if (!isCancelled) {
                    setReviews(result.reviews)
                    setReviewsCursor(result.nextCursor)
                    setHasMoreReviews(result.hasMore)
                }
            } finally {
                if (!isCancelled) {
                    setReviewsLoading(false)
                }
            }
        }

        loadReviews()

        return () => {
            isCancelled = true
        }
    }, [courseId])

    useEffect(() => {
        let isCancelled = false

        const loadStudentsTakingCount = async () => {
            if (!courseId) {
                setStudentsTakingCount(0)
                return
            }

            setStudentsTakingCountLoading(true)
            try {
                const nextCount = await getStudentCountForCourse(courseId)
                if (!isCancelled) {
                    setStudentsTakingCount(nextCount)
                }
            } finally {
                if(!isCancelled) {
                    setStudentsTakingCountLoading(false)
                }
            }
        }

        loadStudentsTakingCount()

        return () => {
            isCancelled = true
        }
    }, [courseId])

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

        const base = sortReviewsBySchoolPriority(reviews, effectiveSchoolIds)
        if (!profile?.uid) {
            return base
        }

        const mine = base.find((review) => String(review.userId) === String(profile.uid))
        if (!mine) {
            return base
        }

        return [mine, ...base.filter((review) => String(review.userId) !== String(profile.uid))]
    }, [reviews, profile?.uid, userStats?.academic?.schoolId, userStats?.academic?.schoolAffiliations])

    const isOverviewLoading = reviewsLoading || studentsTakingCountLoading

    const myReview = useMemo(() => {
        if (!profile?.uid) {
            return null
        }

        return reviews.find((review) => String(review.userId) === String(profile.uid)) ?? null
    }, [reviews, profile?.uid])

    const reviewSummary = useMemo(() => {
        const avgScore = computeAverageScoreFromReviews(reviews)
        const totalReviews = reviews.length
        const scoreBuckets = SCORE_OPTIONS.map((option) => {
            const count = reviews.filter((review) => Number(review?.score) === Number(option.value)).length
            return {
                ...option,
                count,
                percent: totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0,
            }
        })

        const ratingPercent = avgScore == null ? null : Math.max(0, Math.min(100, Math.round(avgScore * 100)))
        const ratingMeta = ratingDescriptions.find((entry) => ratingPercent != null && ratingPercent >= entry.score) ?? ratingDescriptions[ratingDescriptions.length - 1]
        return {
            avgScore,
            ratingPercent,
            totalReviews,
            scoreBuckets,
            ratingMeta,
        }
    }, [reviews])

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

            const nextReview = {
                uid: `${String(courseId)}_${String(profile.uid)}`,
                courseId: String(courseId),
                userId: String(profile.uid),
                schoolId: userStats?.academic?.schoolId ? String(userStats.academic.schoolId) : null,
                teacherId: myEnrollment?.teacherId ? String(myEnrollment.teacherId) : null,
                review: String(reviewText ?? '').trim(),
                score: Number(score),
                lastUpdated: {
                    seconds: Math.floor(Date.now() / 1000),
                },
                ...(myReview?.createdAt ? { createdAt: myReview.createdAt } : {
                    createdAt: {
                        seconds: Math.floor(Date.now() / 1000),
                    },
                })
            }

            setReviews((previous) => {
                const existingIndex = previous.findIndex((entry) => String(entry.userId) === String(profile.uid))
                if (existingIndex === -1) {
                    return [nextReview, ...previous]
                }

                const next = [...previous]
                next[existingIndex] = {
                    ...next[existingIndex],
                    ...nextReview,
                }
                return next
            })

            setReviewText('')
            setScore(DEFAULT_SCORE)
            setIsReviewComposerOpen(false)
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleCancelReview = () => {
        setReviewText('')
        setScore(DEFAULT_SCORE)
        setIsReviewComposerOpen(false)
    }

    const handleOpenNewReviewComposer = () => {
        setReviewText('')
        setScore(DEFAULT_SCORE)
        setIsReviewComposerOpen(true)
    }

    const handleEditMyReview = () => {
        if (!myReview) {
            return
        }

        setReviewText(myReview.review ?? '')
        const nextScore = Number(myReview.score)
        setScore(Number.isNaN(nextScore) ? DEFAULT_SCORE : nextScore)
        setIsReviewComposerOpen(true)
    }

    useEffect(() => {
        if (!isReviewComposerOpen) {
            return
        }

        requestAnimationFrame(() => {
            const input = reviewInputRef.current
            if (!input) {
                return
            }

            input.focus()
            const textLength = input.value?.length ?? 0
            input.setSelectionRange(textLength, textLength)
        })
    }, [isReviewComposerOpen, reviewText])

    const handleDeleteMyReview = async () => {
        if (!profile?.uid || !courseId) {
            return
        }

        setIsDeletingReview(true)
        try {
            await deleteCourseReview(courseId, profile.uid)
            setReviews((previous) => previous.filter((review) => String(review.userId) !== String(profile.uid)))
            setReviewText('')
            setScore(DEFAULT_SCORE)
            setIsReviewComposerOpen(false)
        } finally {
            setIsDeletingReview(false)
        }
    }

    const handleLoadMoreReviews = async () => {
        if(!courseId || isLoadingMoreReviews || !hasMoreReviews) {
            return
        }

        setIsLoadingMoreReviews(true)
        try {
            const result = await getCourseReviews(courseId, {
                limitCount: REVIEW_PAGE_SIZE,
                cursor: reviewsCursor,
            })

            setReviews((previous) => [...previous, ...result.reviews])
            setReviewsCursor(result.nextCursor)
            setHasMoreReviews(result.hasMore)
        } finally {
            setIsLoadingMoreReviews(false)
        }
    }

    const handleLeaveCourse = async () => {

        if (!profile?.uid) {
            return
        }

        await leaveCourse(profile.uid, courseId)

    }

    const handleOpenAddCourseModal = () => {
        if (!course || !profile?.uid) {
            return
        }

        openModal(
            <AddCourseModal
                profile={profile}
                course={course}
                schoolId={userStats?.academic?.schoolId ?? null}
                schoolAffiliations={userStats?.academic?.schoolAffiliations ?? []}
                closeModal={closeModal}
            />
        )
    }

    const handleOpenEditCourseModal = () => {
        if (!course || !profile?.uid || !myEnrollment) {
            return
        }

        openModal(
            <EditCourseModal
                profile={profile}
                course={course}
                enrollment={myEnrollment}
                closeModal={closeModal}
            />
        )
    }

    if(!course) {
        return <p className='text-sm text-neutral1'>Course not found.</p>
    }

    if(isOverviewLoading) {
        return <LoadingState/>
    }

    return (
        <div className='w-full flex flex-col gap-6 pb-12'>

            <div className='flex gap-8'>
                <Card className={'flex-2 p-2! overflow-hidden gap-0!'}>
                    <div
                        className='p-6 w-full h-48 flex items-center justify-center rounded-xl'
                        style={{ backgroundColor: courseHeroBackground ?? '#9ca3af33' }}
                    >
                        <FaBook className='text-8xl' style={{ color: myEnrollment ? enrolledCourseColor : '#9ca3af' }} />
                    </div>
                    <div className='p-4'>
                        <div>
                            <h2 className='text-xl font-semibold text-neutral0'>{course.title}</h2>
                            <p className='text-sm text-neutral1'>{course.subject}</p>
                        </div>
                        <p className='text-sm text-neutral1 mt-2'>{course.description || 'No description available.'}</p>
                    </div>
                </Card>
                <div className='flex-1 flex flex-col gap-6'>

                    <Card className='flex-1 justify-center p-6! gap-6!'>
                        <div className='flex items-center gap-6'>
                            <reviewSummary.ratingMeta.icon className='text-3xl text-neutral2' />
                            <div className='flex flex-col'>
                                <h2 className='font-bold text-2xl leading-5'>
                                    {reviewSummary.ratingPercent == null ? 'No ratings' : reviewSummary.ratingMeta.description}
                                </h2>
                                <p className='text-sm text-neutral1'>{reviewSummary.ratingPercent != null && 'ratings'} from students</p>
                            </div>
                        </div>
                        <hr className='border-neutral4 rounded-full' />
                        <div className='flex items-center gap-6'>
                            <FaUserGroup className='text-3xl text-neutral2' />
                            <div className='flex flex-col'>
                                <h2 className='font-bold text-2xl leading-5'>{studentsTakingCount}</h2>
                                <p className='text-sm text-neutral1'>student{studentsTakingCount != 1 && 's'} taking this course</p>
                            </div>
                        </div>
                        <hr className='border-neutral4 rounded-full' />
                        <div className='flex items-center gap-6'>
                            <FaBoxArchive className='text-3xl text-neutral2' />
                            <div className='flex flex-col'>
                                <h2 className='font-bold text-2xl leading-5'>0</h2>
                                <p className='text-sm text-neutral1'>resource{0 != 1 && 's'} for this course</p>
                            </div>
                        </div>
                    </Card>

                    <div className='flex gap-3'>
                        {myEnrollment == null ? (
                            <Button
                                type='primary'
                                className='flex-1 py-4!'
                                onClick={isCourseLimitReached ? undefined : handleOpenAddCourseModal}
                                disabled={isCourseLimitReached}
                            >
                                {isCourseLimitReached ? 'Course limit reached' : 'Join Course'}
                            </Button>
                        ) : (
                            <>
                                <Button type='secondary' className='flex-1 py-4!' onClick={handleOpenEditCourseModal}>
                                    Edit Course
                                </Button>
                                <Button
                                    type='negative'
                                    className='py-4! aspect-square'
                                    onClick={() => handleLeaveCourse()}
                                >
                                    <FaArrowRightFromBracket />
                                </Button>
                            </>
                        )}
                    </div>

                </div>

            </div>

            <section className='flex flex-col gap-12'>

                <div className='flex flex-col gap-6'>
                    <h2 className='text-2xl font-semibold'>Reviews</h2>

                    <Card className='p-12! flex flex-row justify-between items-center'>
                        <div>
                            <h2 className={`font-bold
                                animate-shine bg-[length:200%_auto] 
                                bg-gradient-to-r from-neutral0 via-[#4f5d72] to-neutral0 
                                from-30% to-70%
                                bg-clip-text text-transparent
                                ${reviewSummary.totalReviews > 0 ? 'text-7xl' : 'text-4xl'}`}
                            >
                                {formatScoreLabel(reviewSummary.avgScore)}
                            </h2>
                            <p className='text-lg text-neutral1'>{reviewSummary.totalReviews} review{reviewSummary.totalReviews != 1 && 's'}</p>
                        </div>
                        <div className='min-w-lg flex flex-col gap-4'>
                            {reviewSummary.scoreBuckets.map((bucket) => {

                                const Icon = bucket.icon

                                return (
                                    <div key={bucket.value} className='flex items-center'>
                                        <div className='w-16 text-xs text-neutral1 flex items-center gap-2'>
                                            <Icon />
                                            <span>{bucket.label}</span>
                                        </div>
                                        <ProgressBar
                                            value={bucket.count}
                                            max={Math.max(reviewSummary.totalReviews, 1)}
                                            className='h-3 flex-1'
                                        />
                                        <p className='pl-3 text-right text-xs text-neutral1'>
                                            {bucket.count}
                                        </p>
                                    </div>
                                )

                            })}
                        </div>
                    </Card>
                </div>

                <div className='flex flex-col gap-6'>

                    <h2 className='text-neutral1'>Showing {sortedReviews.length} review{sortedReviews.length != 1 && 's'}</h2>
                    {isReviewComposerOpen ? (
                        <form onSubmit={handleSubmitReview} className='flex flex-col rounded-3xl overflow-hidden border border-neutral4'>

                            <textarea
                                ref={reviewInputRef}
                                value={reviewText}
                                onChange={(event) => setReviewText(event.target.value)}
                                rows={4}
                                placeholder='Share your experience...'
                                className='w-full px-4 py-3 text-sm text-neutral0 focus:outline-none'
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
                                                className={`px-4 py-1 rounded-full border text-xs flex items-center gap-2 cursor-pointer transition
                                                    ${score === option.value ? 'text-neutral6 bg-neutral0' : 'border-neutral4 text-neutral1 hover:bg-neutral5'}
                                                `}
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
                                        {isSubmitting ? 'Saving...' : (myReview ? 'Update' : 'Post Review')}
                                    </Button>
                                </div>

                            </div>

                        </form>
                    ) : (
                        <button
                            type='button'
                            onClick={myReview ? undefined : handleOpenNewReviewComposer}
                            className={`w-full text-left text-sm text-neutral1 rounded-full border border-neutral4 px-4 py-3 
                                ${myReview ? 'opacity-60 cursor-not-allowed' : 'hover:bg-neutral5 cursor-pointer'}
                                transition-colors
                            `}
                        >
                            Share your experience...
                        </button>
                    )}

                    <div className='grid grid-cols-3 gap-3'>

                        {sortedReviews.length === 0 ? (
                            <div className='col-span-3 flex flex-col items-center py-16'>
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
                                        canManage={String(review.userId) === String(profile?.uid)}
                                        onEdit={String(review.userId) === String(profile?.uid) ? handleEditMyReview : undefined}
                                        onDelete={String(review.userId) === String(profile?.uid) ? handleDeleteMyReview : undefined}
                                        deleting={String(review.userId) === String(profile?.uid) ? isDeletingReview : false}
                                    />
                                )

                            })
                        )}
                    </div>

                    {hasMoreReviews ? (
                        <div className='w-full flex justify-center pt-4'>
                            <Button
                                type='secondary'
                                onClick={handleLoadMoreReviews}
                                disabled={isLoadingMoreReviews}
                            >
                                {isLoadingMoreReviews ? 'Loading...' : 'Load More'}
                            </Button>
                        </div>
                    ) : null}

                </div>


            </section>

        </div>
    )
}

export default CourseOverview