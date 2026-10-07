import test from 'node:test'
import assert from 'node:assert/strict'
import { getChatSenderPresentation } from './chatPresentation.js'

test('spectator messages are labeled for other viewers and optimistically for their sender', () => {
    const message = { userId: 'viewer', senderName: 'Alex', senderRole: 'spectator' }
    assert.equal(getChatSenderPresentation(message, 'player').senderLabel, '(SPECTATOR) Alex')
    assert.equal(getChatSenderPresentation(message, 'viewer').senderLabel, '(SPECTATOR) You')
    assert.equal(getChatSenderPresentation(message, 'viewer').isSpectatorMessage, true)
})

test('legacy player and system messages retain their existing presentation', () => {
    assert.deepEqual(getChatSenderPresentation({ userId: 'player', senderName: 'Alex' }, 'viewer'), {
        isSystemMessage: false,
        isSpectatorMessage: false,
        senderLabel: 'Alex',
    })
    assert.equal(getChatSenderPresentation({ userId: null, senderName: 'System', system: true }, 'viewer').isSystemMessage, true)
})
