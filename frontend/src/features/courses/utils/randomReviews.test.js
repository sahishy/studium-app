import test from 'node:test'
import assert from 'node:assert/strict'
import { selectRandomReviews } from './randomReviews.js'

const reviews = Array.from({ length: 5 }, (_, index) => ({ uid: `r${index}`, userId: `u${index}`, courseId: 'math', review: 'A useful course', score: index % 2 }))

test('zero, one, or two reviews shows exactly the available reviews', () => {
    for(let count = 0; count < 3; count += 1) {
        const available = reviews.slice(0, count)
        assert.deepEqual(selectRandomReviews(available, () => 0), available)
    }
})

test('all reviews can be selected, including your own and rating-only reviews', () => {
    const available = [
        { ...reviews[0], userId: 'current-user' },
        { ...reviews[1], courseId: 'removed' },
        { ...reviews[2], review: '' },
    ]
    assert.deepEqual(selectRandomReviews(available, () => 0), available)
})

test('sampling returns three distinct reviews, allows repeated courses, and does not mutate input', () => {
    const original = structuredClone(reviews)
    const first = selectRandomReviews(reviews, () => 0)
    const second = selectRandomReviews(reviews, () => 0.99)
    assert.equal(first.length, 3)
    assert.equal(new Set(first.map(review => review.uid)).size, 3)
    assert.equal(new Set(first.map(review => review.courseId)).size, 1)
    assert.notDeepEqual(first, second)
    assert.deepEqual(reviews, original)
    assert.equal(selectRandomReviews(reviews.slice(0, 3)).length, 3)
})
