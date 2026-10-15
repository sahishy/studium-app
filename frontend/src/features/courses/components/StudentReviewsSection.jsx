import { useEffect, useState } from 'react'
import { getRandomCourseReviews, getUsersByIdsMap } from '../services/reviewService'
import CourseReviewCard from './CourseReviewCard'
import LoadingState from '../../../shared/components/ui/LoadingState'
import ErrorState from '../../../shared/components/ui/ErrorState'
import Button from '../../../shared/components/ui/Button'

const StudentReviewsSection = () => {
    const [reviews, setReviews] = useState([])
    const [users, setUsers] = useState({})
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [attempt, setAttempt] = useState(0)

    useEffect(() => {
        let cancelled = false
        const load = async () => {
            setLoading(true)
            setError('')
            try {
                const selected = await getRandomCourseReviews()
                const authors = await getUsersByIdsMap(selected.map(review => review.userId))
                if(!cancelled) { setReviews(selected); setUsers(authors) }
            } catch(loadError) {
                if(!cancelled) setError(loadError.message)
            } finally {
                if(!cancelled) setLoading(false)
            }
        }
        load()
        return () => { cancelled = true }
    }, [attempt])

    return (
        <section className='w-full mb-8' aria-label='What students are saying'>
            <h2 className='text-xl font-semibold mb-4'>What students are saying</h2>
            {loading ? <LoadingState /> : error ? (
                <div className='flex flex-col items-center gap-3'>
                    <ErrorState title='Could not load reviews' description={error} />
                    <Button onClick={() => setAttempt(value => value + 1)}>Try again</Button>
                </div>
            ) : reviews.length > 0 ? (
                <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'>
                    {reviews.map(review => <CourseReviewCard key={review.uid} review={review} reviewer={users[review.userId]} showCourse />)}
                </div>
            ) : <ErrorState title='Nothing here yet' description='Be the first to review a course.' />}
        </section>
    )
}

export default StudentReviewsSection
