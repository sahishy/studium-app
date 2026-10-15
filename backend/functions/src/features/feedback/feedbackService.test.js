import test from 'node:test'
import assert from 'node:assert/strict'
import { deliverFeedback, validateFeedback } from './feedbackService.js'
import { submitWithCooldown } from './feedbackSubmission.js'

const webhookUrl = 'https://discord.com/api/webhooks/123/test-token'
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=', 'base64')

const createTestDb = (initialState = {}) => {
    let state = initialState
    let queue = Promise.resolve()
    return {
        collection: () => ({ doc: () => 'feedback-limit' }),
        runTransaction: (handler) => {
            const result = queue.then(async () => {
                let nextState = state
                const value = await handler({
                    get: async () => ({ data: () => state }),
                    set: (_ref, data) => { nextState = data },
                })
                state = nextState
                return value
            })
            queue = result.catch(() => {})
            return result
        },
    }
}

test('failed delivery releases the cooldown so a retry can succeed immediately', async () => {
    const args = { db: createTestDb(), uid: 'user-123', now: () => 100_000 }
    await assert.rejects(submitWithCooldown({ ...args, deliver: async () => { throw new Error('Delivery failed') } }), /Delivery failed/)
    assert.deepEqual(await submitWithCooldown({ ...args, deliver: async () => ({ ok: true }) }), { ok: true })
})

test('successful delivery blocks repeat submissions with 429, then allows them after a minute', async () => {
    let time = 100_000
    let calls = 0
    const args = { db: createTestDb(), uid: 'user-123', now: () => time, deliver: async () => { calls++; return { ok: true } } }
    await submitWithCooldown(args)
    await assert.rejects(submitWithCooldown(args), (error) => error.statusCode === 429)
    assert.equal(calls, 1)
    time += 60_000
    await submitWithCooldown(args)
    assert.equal(calls, 2)
})

test('blocks concurrent sends while the first submission is pending', async () => {
    let finishDelivery
    let notifyStarted
    const started = new Promise((resolve) => { notifyStarted = resolve })
    const args = { db: createTestDb(), uid: 'user-123', now: () => 100_000 }
    const first = submitWithCooldown({ ...args, deliver: () => {
        notifyStarted()
        return new Promise((resolve) => { finishDelivery = resolve })
    } })
    await started
    await assert.rejects(submitWithCooldown({ ...args, deliver: async () => assert.fail('Duplicate send') }), (error) => {
        assert.equal(error.statusCode, 429)
        assert.match(error.message, /still sending/)
        return true
    })
    finishDelivery({ ok: true })
    await first
})

test('an abandoned pending submission expires and allows a new attempt', async () => {
    const db = createTestDb({ pendingAttemptId: 'abandoned', pendingAt: 50_000 })
    assert.deepEqual(await submitWithCooldown({ db, uid: 'user-123', now: () => 100_000, deliver: async () => ({ ok: true }) }), { ok: true })
})

test('requires a trimmed description within Discord embed limits', () => {
    assert.equal(validateFeedback({ category: 'suggestion', description: '  An idea  ' }).description, 'An idea')
    for (const body of [undefined, {}, { description: '   ' }, { description: 123 }, { description: 'x'.repeat(4001) }]) {
        assert.throws(() => validateFeedback(body), /Describe/)
    }
})

test('requires a known feedback category and rejects arbitrary tags', () => {
    for (const category of [undefined, null, '', 'other', 'toString', ['suggestion'], '1533505595943161896']) {
        assert.throws(() => validateFeedback({ description: 'Feedback', category }), /Select Suggestion or Bug report/)
    }
    for (const category of ['suggestion', 'bug-report']) {
        assert.equal(validateFeedback({ description: 'Feedback', category }).category, category)
    }
})

test('rejects unsupported, disguised, malformed, and oversized images', () => {
    for (const attachment of [
        { type: 'image/svg+xml', data: png.toString('base64') },
        { type: 'image/png', data: Buffer.from('not an image').toString('base64') },
        { type: 'image/png', data: 'invalid!base64' },
        { type: 'image/png', data: Buffer.alloc(5 * 1024 * 1024 + 1).toString('base64') },
    ]) assert.throws(() => validateFeedback({ category: 'suggestion', description: 'Feedback', attachment }), /image/i)
})

test('creates a Forum thread and suppresses mentions for text feedback', async () => {
    const result = await deliverFeedback({
        webhookUrl, uid: 'user-123', displayName: 'Student',
        feedback: validateFeedback({ category: 'suggestion', description: 'An idea\n@everyone' }),
        fetchImpl: async (url, options) => {
            assert.equal(url.searchParams.get('wait'), 'true')
            assert.equal(options.method, 'POST')
            const payload = JSON.parse(options.body.get('payload_json'))
            assert.equal(payload.thread_name, 'Feedback: An idea @everyone')
            assert.deepEqual(payload.applied_tags, ['1533505595943161896'])
            assert.deepEqual(payload.allowed_mentions, { parse: [] })
            assert.equal(payload.embeds[0].description, 'An idea\n@everyone')
            assert.deepEqual(payload.embeds[0].fields, [{ name: 'Submitted by', value: 'Student' }])
            assert.equal(JSON.stringify(payload).includes('user-123'), false)
            assert.equal(options.body.has('files[0]'), false)
            return { ok: true }
        },
    })
    assert.deepEqual(result, { ok: true })
})

test('sends actual image bytes and references the multipart attachment in the embed', async () => {
    await deliverFeedback({
        webhookUrl, uid: 'user-123',
        feedback: validateFeedback({ category: 'bug-report', description: 'A bug', attachment: { type: 'image/png', data: png.toString('base64') } }),
        fetchImpl: async (_url, options) => {
            const payload = JSON.parse(options.body.get('payload_json'))
            const file = options.body.get('files[0]')
            assert.deepEqual(payload.applied_tags, ['1533505612179046581'])
            assert.equal(file.name, 'feedback.png')
            assert.equal(file.type, 'image/png')
            assert.deepEqual(Buffer.from(await file.arrayBuffer()), png)
            assert.deepEqual(payload.attachments, [{ id: 0, filename: 'feedback.png' }])
            assert.equal(payload.embeds[0].image.url, 'attachment://feedback.png')
            return { ok: true }
        },
    })
})

test('does not report success for rejected or unconfirmed delivery and never leaks the secret', async () => {
    const args = { webhookUrl, uid: 'user-123', feedback: validateFeedback({ category: 'suggestion', description: 'Feedback' }) }
    await assert.rejects(deliverFeedback({ ...args, fetchImpl: async () => ({ ok: false, status: 400 }) }), /Could not send/)
    await assert.rejects(deliverFeedback({ ...args, fetchImpl: async () => ({ ok: false, status: 429 }) }), /busy/)
    for (const status of [401, 404]) {
        await assert.rejects(deliverFeedback({ ...args, fetchImpl: async () => ({ ok: false, status }) }), (error) => {
            assert.equal(error.statusCode, 502)
            assert.match(error.message, /unavailable/)
            assert.equal(error.message.includes('test-token'), false)
            return true
        })
    }
    await assert.rejects(deliverFeedback({ ...args, fetchImpl: async () => { throw new Error(webhookUrl) } }), (error) => {
        assert.match(error.message, /Could not confirm/)
        assert.equal(error.message.includes('test-token'), false)
        return true
    })
    await assert.rejects(deliverFeedback({ ...args, webhookUrl: '' }), /unavailable/)
})
