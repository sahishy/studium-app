import { FieldValue } from 'firebase-admin/firestore'
import { db } from '../../lib/firebaseAdmin.js'

const ACTIVITY_STATES = new Set(['online', 'in_party', 'in_game'])
const MAX_BATCH_SIZE = 8
const MODE_ID_PATTERN = /^[a-z0-9-]{1,64}$/

const normalizeActivityUpdates = (payload) => {
    const updates = Array.isArray(payload?.updates) ? payload.updates : []
    if(!updates.length || updates.length > MAX_BATCH_SIZE) {
        throw new Error(`updates must contain between 1 and ${MAX_BATCH_SIZE} entries.`)
    }

    const userIds = new Set()
    return updates.map((update) => {
        const userId = String(update?.userId ?? '').trim()
        const state = String(update?.activity?.state ?? '')
        const modeId = update?.activity?.modeId == null ? null : String(update.activity.modeId)
        const partyPlayerCount = update?.activity?.partyPlayerCount == null ? null : Number(update.activity.partyPlayerCount)

        if(!userId || userId.length > 256 || userIds.has(userId)) throw new Error('Each update must have a unique userId.')
        if(!ACTIVITY_STATES.has(state)) throw new Error('Invalid activity state.')
        if((state === 'in_party' || state === 'in_game') && (!modeId || !MODE_ID_PATTERN.test(modeId))) {
            throw new Error('Party and game activity requires a valid modeId.')
        }
        if(state === 'online' && (modeId != null || partyPlayerCount != null)) {
            throw new Error('Online activity cannot include metadata.')
        }
        if(state === 'in_game' && partyPlayerCount != null) throw new Error('Game activity cannot include partyPlayerCount.')
        if(state === 'in_party' && (!Number.isInteger(partyPlayerCount) || partyPlayerCount < 1 || partyPlayerCount > 8)) {
            throw new Error('Party activity requires a partyPlayerCount between 1 and 8.')
        }

        userIds.add(userId)
        const activity = { state }
        if(modeId) activity.modeId = modeId
        if(state === 'in_party') activity.partyPlayerCount = partyPlayerCount
        return { userId, activity }
    })
}

const saveActivityUpdates = async (payload) => {
    const updates = normalizeActivityUpdates(payload)
    const batch = db.batch()
    updates.forEach(({ userId, activity }) => {
        batch.set(db.collection('users').doc(userId), {
            activity: { ...activity, updatedAt: FieldValue.serverTimestamp() },
        }, { merge: true })
    })
    await batch.commit()
    return { updated: updates.length }
}

export { normalizeActivityUpdates, saveActivityUpdates }
