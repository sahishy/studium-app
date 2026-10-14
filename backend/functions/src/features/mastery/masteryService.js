import { db } from '../../lib/firebaseAdmin.js'

// The eight domains the College Board assigns every SAT question, four per section. These are the
// exact `primary_class_cd_desc` strings carried by the question bank, so a tally keyed on a
// question's domain lines up with this list without any mapping.
const SAT_DOMAINS = Object.freeze([
    { id: 'Information and Ideas', section: 'reading', label: 'Information & Ideas', short: 'Info' },
    { id: 'Craft and Structure', section: 'reading', label: 'Craft & Structure', short: 'Craft' },
    { id: 'Expression of Ideas', section: 'reading', label: 'Expression of Ideas', short: 'Expression' },
    { id: 'Standard English Conventions', section: 'reading', label: 'Standard English Conventions', short: 'Conventions' },
    { id: 'Algebra', section: 'math', label: 'Algebra', short: 'Algebra' },
    { id: 'Advanced Math', section: 'math', label: 'Advanced Math', short: 'Advanced' },
    { id: 'Problem-Solving and Data Analysis', section: 'math', label: 'Problem-Solving & Data', short: 'Data' },
    { id: 'Geometry and Trigonometry', section: 'math', label: 'Geometry & Trigonometry', short: 'Geometry' },
])

const SAT_DOMAIN_IDS = Object.freeze(SAT_DOMAINS.map((domain) => domain.id))

// How fast a domain's recent-form curve reacts, per question answered in that domain. A single
// question nudges it; a five-question run moves it visibly. Without a recent-form figure the
// lifetime ratio of a heavy player stops responding to a session, which is exactly the feedback
// the skill web exists to give.
const MASTERY_EWMA_WEIGHT = 0.15

// A domain needs this many answered questions before its accuracy is presented as meaningful.
// Below it the web still draws, but the client marks the axis provisional.
const MASTERY_CONFIDENCE_THRESHOLD = 10

const foldDomainTally = (current = {}, tally = {}, now = new Date()) => {
    const answered = Math.max(0, Math.floor(Number(tally.answered) || 0))
    if(!answered) return current ?? null

    const correct = Math.min(answered, Math.max(0, Math.floor(Number(tally.correct) || 0)))
    const matchAccuracy = correct / answered
    const previous = Number(current?.accuracyEwma ?? 0.5)
    const weight = Math.min(1, MASTERY_EWMA_WEIGHT * answered)

    return {
        answered: (Math.max(0, Number(current?.answered) || 0)) + answered,
        correct: (Math.max(0, Number(current?.correct) || 0)) + correct,
        accuracyEwma: Number.isFinite(previous)
            ? (previous * (1 - weight)) + (matchAccuracy * weight)
            : matchAccuracy,
        lastPlayedAt: now,
    }
}

// Merges one match's per-domain tallies into a stored mastery map. Unknown domain strings are
// dropped rather than stored, so a change to the question bank cannot grow an unbounded map of
// junk keys on every user document.
const foldMastery = (existing = {}, byDomain = {}, now = new Date()) => {
    const next = { ...(existing ?? {}) }

    for(const [domain, tally] of Object.entries(byDomain ?? {})) {
        if(!SAT_DOMAIN_IDS.includes(domain)) continue
        const folded = foldDomainTally(next[domain], tally, now)
        if(folded) next[domain] = folded
    }

    return next
}

// Flattens stored mastery into the shape the skill web renders: one entry per domain, always all
// eight, in a fixed order so the polygon never changes shape because of missing data.
const describeMastery = (mastery = {}) => SAT_DOMAINS.map((domain) => {
    const stored = mastery?.[domain.id] ?? {}
    const answered = Math.max(0, Number(stored.answered) || 0)
    const correct = Math.max(0, Number(stored.correct) || 0)
    const lifetimeAccuracy = answered ? correct / answered : 0
    const recent = Number(stored.accuracyEwma)

    return {
        ...domain,
        answered,
        correct,
        lifetimeAccuracy,
        // Recent form is what the web plots; the lifetime ratio backs it up in the tooltip.
        accuracy: answered ? (Number.isFinite(recent) ? recent : lifetimeAccuracy) : 0.5,
        confident: answered >= MASTERY_CONFIDENCE_THRESHOLD,
    }
})

// Mastery is stored on the stats document alongside per-mode play records. Read outside a
// transaction: nothing here writes, and a reader does not need to block a match settling.
const describeMasteryBoard = (mastery = {}) => {
    const domains = describeMastery(mastery)
    const answered = domains.reduce((total, domain) => total + domain.answered, 0)

    return {
        domains,
        answered,
        correct: domains.reduce((total, domain) => total + domain.correct, 0),
        // Below this there is nothing honest to show, and the client draws its empty state
        // instead of a web built from two questions.
        hasData: answered > 0,
        strongest: answered ? [...domains].sort((a, b) => b.accuracy - a.accuracy)[0]?.id ?? null : null,
        weakest: answered
            ? [...domains].filter((domain) => domain.answered > 0).sort((a, b) => a.accuracy - b.accuracy)[0]?.id ?? null
            : null,
    }
}

const getMasteryBoard = async (userId) => {
    const snap = await db.collection('userStats').doc(String(userId)).get()
    return describeMasteryBoard(snap.exists ? (snap.data()?.mastery ?? {}) : {})
}

// Only the caller's comparison is returned; other participants' skill history stays private.
const getMatchMastery = async (userId, gameId) => {
    const snap = await db.collection('gameResults').doc(String(gameId)).get()
    if(!snap.exists) return { pending: true }
    const result = snap.data()
    if(!result.playerIds?.includes(userId)) throw new Error('Unauthorized.')
    return { pending: false, comparison: result.masteryByUserId?.[userId] ?? null }
}

export {
    MASTERY_CONFIDENCE_THRESHOLD,
    getMasteryBoard,
    MASTERY_EWMA_WEIGHT,
    SAT_DOMAINS,
    SAT_DOMAIN_IDS,
    describeMastery,
    describeMasteryBoard,
    getMatchMastery,
    foldDomainTally,
    foldMastery,
}
