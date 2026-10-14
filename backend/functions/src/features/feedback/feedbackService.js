const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const FEEDBACK_TAG_IDS = {
    suggestion: '1533505595943161896',
    'bug-report': '1533505612179046581',
}
const IMAGE_EXTENSIONS = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' }

const hasImageSignature = (bytes, type) => {
    if (type === 'image/png') return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    if (type === 'image/jpeg') return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    if (type === 'image/gif') return ['GIF87a', 'GIF89a'].includes(bytes.subarray(0, 6).toString())
    if (type === 'image/webp') return bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP'
    return false
}

export const validateFeedback = (body) => {
    const description = typeof body?.description === 'string' ? body.description.trim() : ''
    if (!description || description.length > 4000) throw new Error('Describe your feedback in 1–4,000 characters.')
    const category = body.category
    if (typeof category !== 'string' || !Object.hasOwn(FEEDBACK_TAG_IDS, category)) {
        throw new Error('Select Suggestion or Bug report.')
    }
    let attachment = null
    if (body.attachment != null) {
        const { type, data } = body.attachment
        if (!Object.hasOwn(IMAGE_EXTENSIONS, type) || typeof data !== 'string'
            || !data.length || data.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4
            || !/^[A-Za-z0-9+/]*={0,2}$/.test(data)) {
            throw new Error('Choose a PNG, JPG, WebP, or GIF image smaller than 5 MB.')
        }
        const bytes = Buffer.from(data, 'base64')
        if (!bytes.length || bytes.length > MAX_IMAGE_BYTES || bytes.toString('base64') !== data || !hasImageSignature(bytes, type)) {
            throw new Error('Your image is invalid or larger than 5 MB.')
        }
        attachment = { bytes, type, filename: `feedback.${IMAGE_EXTENSIONS[type]}` }
    }
    return { description, attachment, category }
}

export const deliverFeedback = async ({ webhookUrl, feedback, displayName, fetchImpl = fetch }) => {
    // Only the server supplies this URL; never accept a destination from the client.
    if (!webhookUrl) throw new Error('Feedback is temporarily unavailable. Please try again later.')
    const url = new URL(webhookUrl)
    if (url.protocol !== 'https:' || url.hostname !== 'discord.com' || !url.pathname.startsWith('/api/webhooks/')) {
        throw new Error('Feedback is temporarily unavailable. Please try again later.')
    }
    url.searchParams.set('wait', 'true')
    const name = String(displayName || 'Studium user').slice(0, 80)
    const payload = {
        thread_name: `Feedback: ${feedback.description.replace(/\s+/g, ' ').slice(0, 85)}`,
        applied_tags: [FEEDBACK_TAG_IDS[feedback.category]],
        allowed_mentions: { parse: [] },
        embeds: [{
            title: 'Studium Feedback',
            description: feedback.description,
            fields: [{ name: 'Submitted by', value: name }],
            timestamp: new Date().toISOString(),
            ...(feedback.attachment ? { image: { url: `attachment://${feedback.attachment.filename}` } } : {}),
        }],
    }
    const form = new FormData()
    if (feedback.attachment) {
        const { bytes, type, filename } = feedback.attachment
        payload.attachments = [{ id: 0, filename }]
        form.append('files[0]', new Blob([bytes], { type }), filename)
    }
    form.append('payload_json', JSON.stringify(payload))
    let response
    try {
        response = await fetchImpl(url, { method: 'POST', body: form, signal: AbortSignal.timeout(20_000) })
    } catch {
        // Fetch errors can contain the webhook token. Return only a safe message.
        throw new Error('Could not confirm delivery. Please wait a minute before trying again.')
    }
    if (!response.ok) {
        // Log only the status, never Discord's response or the webhook URL/token.
        console.error('Discord rejected feedback delivery.', { status: response.status })
        if (response.status === 401 || response.status === 404) {
            throw Object.assign(new Error('Feedback is temporarily unavailable. Please try again later.'), { statusCode: 502 })
        }
        throw new Error(response.status === 429
            ? 'Feedback is busy right now. Please wait a minute before trying again.'
            : 'Could not send your feedback. Please try again.')
    }
    return { ok: true }
}
