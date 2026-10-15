import { db } from '../../lib/firebaseAdmin.js'
import { randomInt } from 'node:crypto'

// Only supply missing defaults. In particular, repairing an old presence-only document
// must never reset earned progression, memberships, avatar unlocks, or academic stats.
export const ensureUserProfile = async (identity, { displayName, timeZone } = {}) => {
    const uid = identity.uid
    const userRef = db.collection('users').doc(uid)
    const statsRef = db.collection('userStats').doc(uid)
    const avatarColor = ['#fcd34d', '#22c55e', '#60a5fa', '#f87171'][randomInt(4)]
    return db.runTransaction(async tx => {
        const [user, stats] = await Promise.all([tx.get(userRef), tx.get(statsRef)])
        const data = user.data() || {}
        const profile = data.profile || {}
        const hasName = typeof profile.displayName === 'string' && profile.displayName.trim().length > 0
        if(!hasName) {
            if(typeof displayName !== 'string' || !/^[A-Za-z0-9]{3,23}$/.test(displayName)) throw new Error('Invalid display name.')
            const matches = await tx.get(db.collection('users').where('profile.displayName', '==', displayName).limit(1))
            if(!matches.empty) throw new Error('Display name is already taken. Please try again.')
        }
        const now = new Date()
        const next = {
            email: data.email ?? identity.email ?? null,
            createdAt: data.createdAt ?? now,
            primaryCircleId: data.primaryCircleId ?? null,
            circleMemberships: data.circleMemberships ?? { version: 1, ids: [] },
            profile: {
                ...profile,
                displayName: hasName ? profile.displayName : displayName,
                avatar: { color: avatarColor, face: 0, ...profile.avatar },
                profilePicture: profile.profilePicture ?? { url: '', lastUpdated: now },
                flair: profile.flair ?? null,
            },
            progress: { level: 1, xp: 0, streak: 0, tasksCompleted: 0, ...data.progress },
            preferences: { timeZone: timeZone || 'UTC', ...data.preferences },
        }
        tx.set(userRef, next, { merge: true })
        if(!stats.exists) tx.create(statsRef, {
            userId: uid,
            academic: { targetMajors: [], scores: { sat: null, act: null }, gpa: { unweighted: null, weighted: null }, extracurriculars: [], awards: [], college: { committed: null, acceptances: [] } },
            play: {}, lastUpdated: now,
        })
        return { ok: true }
    })
}
