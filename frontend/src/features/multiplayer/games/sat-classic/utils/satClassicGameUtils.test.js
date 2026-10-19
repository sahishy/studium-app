import assert from 'node:assert/strict'
import test from 'node:test'
import { getCurrentQuestion, getHealthBoard } from './satClassicGameUtils.js'

test('the final round keeps its question available while showing answer feedback', () => {
    const question = { id: 'last', prompt: 'Final question' }
    assert.deepEqual(getCurrentQuestion({
        phase: 'finished',
        currentQuestionId: 'last',
        questionsById: {},
        reviewQuestionsById: { last: question },
    }), { questionId: 'last', question })
})

test('getHealthBoard preserves generated avatars for bot players', () => {
    const botAvatar = { color: '#60a5fa', face: 2 }
    const players = [
        {
            userId: 'human',
            displayName: 'Human',
            profilePicture: { url: 'https://example.test/human.png' },
            state: { health: 2500 },
        },
        {
            userId: 'bot',
            displayName: 'Bot',
            profilePicture: null,
            avatar: botAvatar,
            state: { health: 1800 },
        },
    ]

    const board = getHealthBoard({ players, userId: 'human' })

    assert.deepEqual(board.rightPlayer.avatar, botAvatar)
    assert.equal(board.rightPlayer.profilePicture, null)
    assert.equal(board.rightPlayer.name, 'Bot')
    assert.equal(board.rightPlayer.health, 1800)
})
