import assert from 'node:assert/strict'
import test from 'node:test'
import { appendChatMessage } from './chat.ts'
import { canSpectatorSendMessage, getGameConnectionRole } from './connection-role.ts'

const game = (playerIds) => ({ players: playerIds.map((userId) => ({ userId })) })

test('multiplayer rooms classify nonplayers as spectators while solo rooms reject them', () => {
    assert.equal(getGameConnectionRole(game(['one', 'two']), 'one'), 'player')
    assert.equal(getGameConnectionRole(game(['one', 'two']), 'viewer'), 'spectator')
    assert.equal(getGameConnectionRole(game(['one']), 'viewer'), null)
})

test('spectators may synchronize and chat but cannot mutate or forfeit a game', () => {
    for(const type of ['game.subscribe', 'game.resync', 'system.clockPing', 'system.rttReport', 'chat.send', 'game.chat']) {
        assert.equal(canSpectatorSendMessage(type), true)
    }
    for(const type of ['game.answer', 'game.chop', 'game.shoot', 'game.flutterInput', 'game.leave']) {
        assert.equal(canSpectatorSendMessage(type), false)
    }
})

test('spectator chat messages are marked by the server', () => {
    const [message] = appendChatMessage([], {
        userId: 'viewer',
        displayName: 'Viewer',
        profilePicture: null,
        connectionRole: 'spectator',
    }, { text: 'hello', clientMessageId: 'client-1' })

    assert.equal(message.senderRole, 'spectator')
    assert.equal(message.senderName, 'Viewer')
})

test('player chat messages remain backward compatible', () => {
    const [message] = appendChatMessage([], {
        userId: 'player',
        displayName: 'Player',
        profilePicture: null,
        connectionRole: 'player',
    }, { text: 'gg' })

    assert.equal(message.senderRole, undefined)
})
