import { db } from '../../lib/firebaseAdmin.js'
import { readAccount, writeAccount } from '../economy/economyService.js'
import { resolveDayKey } from '../quests/questService.js'

// A seven-day cycle that repeats for as long as the streak holds, so there is always a visible
// reason to come back tomorrow and a bigger one at the end of the week.
const STREAK_CYCLE = Object.freeze([
    { lumen: 5, crates: 0 },
    { lumen: 10, crates: 0 },
    { lumen: 15, crates: 0 },
    { lumen: 25, crates: 0 },
    { lumen: 0, crates: 1 },
    { lumen: 35, crates: 0 },
    { lumen: 0, crates: 2 },
])

// How many days the tooltip previews, today included.
const STREAK_PREVIEW_DAYS = 5

// A brand new account sits at streak 0 until its second consecutive day, so day one still has to
// be worth something to claim.
const effectiveStreakDay = (streak) => Math.max(1, Math.floor(Number(streak) || 0) + 1)

const streakRewardForDay = (streakDay) => {
    const day = Math.max(1, Math.floor(Number(streakDay) || 1))
    const reward = STREAK_CYCLE[(day - 1) % STREAK_CYCLE.length]
    return { day, lumen: reward.lumen, crates: reward.crates }
}

const DAY_LETTERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

// `dayKey` is an ISO calendar date, which is what localDayKey produces. Parsed as UTC on purpose:
// the key already encodes the student's local day, so re-interpreting it in another zone would
// shift the weekday label by one.
const dayLetterFor = (dayKey, offset = 0) => {
    const parsed = new Date(`${dayKey}T00:00:00Z`)
    if(Number.isNaN(parsed.getTime())) return ''
    parsed.setUTCDate(parsed.getUTCDate() + offset)
    return DAY_LETTERS[parsed.getUTCDay()]
}

// Today plus the next few days. Upcoming entries assume the streak is kept, which is the whole
// point of showing them: the student can see what they forfeit by skipping a day.
const buildStreakWeek = ({ streak = 0, dayKey = '', claimedToday = false } = {}) => {
    const today = effectiveStreakDay(streak)

    return Array.from({ length: STREAK_PREVIEW_DAYS }, (_, offset) => {
        const reward = streakRewardForDay(today + offset)
        return {
            ...reward,
            offset,
            letter: dayLetterFor(dayKey, offset),
            state: offset > 0 ? 'upcoming' : (claimedToday ? 'claimed' : 'claimable'),
        }
    })
}

const streakSnapshot = (account, dayKey) => {
    const streak = Math.max(0, Number(account.progress?.streak) || 0)
    const claimedToday = account.wallet?.lastStreakClaim?.dayKey === dayKey

    return {
        dayKey,
        streak,
        claimedToday,
        claimable: !claimedToday,
        week: buildStreakWeek({ streak, dayKey, claimedToday }),
    }
}

const getStreakBoard = async (userId, timeZone = 'UTC') => db.runTransaction(async (transaction) => {
    const account = await readAccount(transaction, userId)
    return streakSnapshot(account, resolveDayKey(account, timeZone))
})

// Idempotent through the stored claim key rather than an operation id: there is only ever one
// streak reward per local day, so the day itself is the natural guard against a double claim.
const claimStreakReward = async (userId, timeZone = 'UTC') => db.runTransaction(async (transaction) => {
    const account = await readAccount(transaction, userId)
    const dayKey = resolveDayKey(account, timeZone)

    if(account.wallet?.lastStreakClaim?.dayKey === dayKey) throw new Error('Already claimed today.')

    const streak = Math.max(0, Number(account.progress?.streak) || 0)
    const reward = streakRewardForDay(effectiveStreakDay(streak))

    const { progress, wallet } = writeAccount(transaction, account, {
        lumen: reward.lumen,
        crates: reward.crates,
        progressPatch: { lastStreakClaimDay: reward.day },
    })

    transaction.set(account.walletRef, {
        lastStreakClaim: { dayKey, streakDay: reward.day, claimedAt: new Date() },
    }, { merge: true })

    return {
        reward,
        progress,
        wallet,
        dayKey,
        week: buildStreakWeek({ streak, dayKey, claimedToday: true }),
    }
})

export {
    STREAK_CYCLE,
    STREAK_PREVIEW_DAYS,
    buildStreakWeek,
    claimStreakReward,
    dayLetterFor,
    effectiveStreakDay,
    getStreakBoard,
    streakRewardForDay,
    streakSnapshot,
}
