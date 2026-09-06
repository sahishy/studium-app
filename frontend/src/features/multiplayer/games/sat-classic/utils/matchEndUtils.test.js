import assert from 'node:assert/strict'
import test from 'node:test'
import { buildMatchEndRounds, countAnsweredQuestions } from './matchEndUtils.js'

test('interleaves question and Flutter rounds in event sequence order', () => {
    const events = [
        { uid: 'flight', sequence: 3, type: 'FLUTTER_ROUND_RESOLVED', data: { roundIndex: 0, attempt: 0, winnerUserId: 'p2', ringsClearedByUserId: { p1: 2, p2: 3 } } },
        { uid: 'question', sequence: 2, type: 'QUESTION_RESOLVED', data: { questionId: 'q1', correctAnswer: 'A', roundResults: [
            { userId: 'p1', submittedResponse: 'B', isCorrect: false },
            { userId: 'p2', submittedResponse: 'A', isCorrect: true },
        ] } },
    ]
    const rounds = buildMatchEndRounds({ events, modeId: 'sat-flutter', userId: 'p1', opponentUserId: 'p2', reviewQuestionsById: { q1: { id: 'q1' } } })
    assert.deepEqual(rounds.map((round) => round.kind), ['question', 'minigame'])
    assert.equal(rounds[0].submittedResponse, 'B')
    assert.equal(rounds[1].summary, '2–3 rings cleared')
})

test('counts unique local submissions and excludes unanswered questions', () => {
    const rounds = [
        { kind: 'question', questionId: 'q1', submittedResponse: 'A' },
        { kind: 'question', questionId: 'q1', submittedResponse: 'A' },
        { kind: 'question', questionId: 'q2', submittedResponse: null },
        { kind: 'minigame', questionId: 'q3', submittedResponse: 'A' },
    ]
    assert.equal(countAnsweredQuestions(rounds), 1)
})
