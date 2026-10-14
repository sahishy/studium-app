import cosmeticCatalog from './cosmeticCatalog.json' with { type: 'json' }
import { randomInt } from 'node:crypto'
import { rollCrateRarityPath } from './crateRolls.js'
import { db } from '../../lib/firebaseAdmin.js'
import {
    CRATE_PRICE, DUPLICATE_REFUND, claimableLevels, grantXp, levelReward, normalizeProgress,
} from './progression.js'

const STARTER_COLORS = Object.freeze(cosmeticCatalog.STARTER_COLORS)
const STARTER_FACES = Object.freeze(cosmeticCatalog.STARTER_FACES)
const COLOR_CATALOG = Object.freeze(cosmeticCatalog.COLOR_CATALOG)

// Faces drop from the same crate as colours. Their ids are prefixed so one
// inventory can hold both without collisions.
const FACE_CATALOG = Object.freeze(cosmeticCatalog.FACE_CATALOG)

// Titles sit under a student's display name on their profile and on the match intro banner.
// Everything up to Epic drops from crates; the Legendary three are earned instead, which keeps
// the Legendary crate pool at its original two items so obsidian and the Alien face stay as rare
// as they were, and makes a Legendary title something nobody can simply buy their way to.
const TITLE_CATALOG = Object.freeze(cosmeticCatalog.TITLE_CATALOG)

const DEFAULT_TITLE_ID = 'title-novice'

// How the three earned titles are unlocked. Checked on every account write, so a student who
// qualified before a condition existed picks it up the next time anything touches their account.
const EARNED_TITLE_DEFINITIONS = Object.freeze([
    { id: 'title-1601-scorer', requirement: 'Answer every question in a ranked match correctly.', test: (progress) => (Number(progress.perfectMatches) || 0) >= 1 },
    { id: 'title-undefeated', requirement: 'Win ten ranked matches in a row.', test: (progress) => (Number(progress.bestWinStreak) || 0) >= 10 },
    { id: 'title-immortal', requirement: 'Reach level 25.', test: (progress) => (Number(progress.level) || 1) >= 25 },
])

const EARNED_TITLE_IDS = Object.freeze(EARNED_TITLE_DEFINITIONS.map((entry) => entry.id))

const COSMETIC_CATALOG = Object.freeze([
    ...COLOR_CATALOG.map((item) => ({ ...item, type: 'color' })),
    ...FACE_CATALOG.map((item) => ({ ...item, type: 'face' })),
    ...TITLE_CATALOG.map((item) => ({ ...item, type: 'title' })),
])

// Only ever drawn from for crates. Earned titles are deliberately absent.
const CRATE_CATALOG = Object.freeze(COSMETIC_CATALOG.filter((item) => !item.earned))
const RARITY_ODDS = Object.freeze({ Common: 60, Uncommon: 25, Rare: 11, Epic: 3, Legendary: 1 })
const TIP_AMOUNTS = new Set([10, 25, 50])
const BADGE_DEFINITIONS = Object.freeze([
    { id: 'first-match', label: 'First Match', counter: 'rankedMatches', target: 1 },
    { id: 'ranked-10', label: 'Ranked Regular', counter: 'rankedMatches', target: 10 },
    { id: 'ranked-50', label: 'Ranked Veteran', counter: 'rankedMatches', target: 50 },
    { id: 'tasks-5', label: 'Getting Things Done', counter: 'rewardedTasks', target: 5 },
    { id: 'tasks-25', label: 'Steady Progress', counter: 'rewardedTasks', target: 25 },
    { id: 'first-resource', label: 'Resourceful', counter: 'publishedResources', target: 1 },
    { id: 'first-lesson', label: 'Teacher', counter: 'publishedLessons', target: 1 },
    { id: 'hearts-10', label: 'Helpful', counter: 'heartsReceived', target: 10 },
])

const accountRefs = (userId) => ({
    userRef: db.collection('users').doc(userId),
    walletRef: db.collection('wallets').doc(userId),
})

const readAccount = async (transaction, userId) => {
    const { userRef, walletRef } = accountRefs(userId)
    const [userSnap, walletSnap] = await Promise.all([transaction.get(userRef), transaction.get(walletRef)])
    if(!userSnap.exists) throw new Error('User not found.')
    const user = userSnap.data()
    const progress = normalizeProgress(user?.progress)
    const stored = walletSnap.exists ? walletSnap.data() : {}
    // Level rewards are no longer granted on read: they wait on the progress
    // roadmap until the student claims them.
    const wallet = {
        balance: Math.max(0, Number(stored.balance) || 0),
        crateTokens: Math.max(0, Number(stored.crateTokens) || 0),
        claimedLevels: Array.isArray(stored.claimedLevels) ? stored.claimedLevels.map(Number) : [],
        inventory: Array.isArray(stored.inventory) ? stored.inventory : [],
        // Only the most recent claim is kept: there is one streak reward per local day, so the
        // day key alone decides whether today's is still available. Storing every claimed day
        // would grow without bound for no added behaviour.
        lastStreakClaim: stored.lastStreakClaim ?? null,
    }
    return { userRef, walletRef, user, progress, wallet }
}

const badgesForProgress = (progress) => BADGE_DEFINITIONS.filter((badge) => (Number(progress[badge.counter]) || 0) >= badge.target).map((badge) => badge.id)

// Which earned titles a student qualifies for. Recomputed on every account write rather than
// granted at the moment of the achievement, so somebody who already met a condition before it
// existed picks the title up the next time anything touches their account.
const earnedTitlesForProgress = (progress = {}) => EARNED_TITLE_DEFINITIONS
    .filter((entry) => entry.test(progress))
    .map((entry) => entry.id)

// Everyone owns The Novice, so a brand new profile has something to show rather than a blank line
// under their name.
const grantedTitles = (progress, inventory = []) => [...new Set([
    DEFAULT_TITLE_ID,
    ...inventory,
    ...earnedTitlesForProgress(progress),
])]

const writeAccount = (transaction, account, {
    xp = 0,
    lumen = 0,
    crates = 0,
    counter = null,
    counters = [],
    progressPatch = null,
    claimedLevels = null,
} = {}) => {
    const incremented = [counter, ...counters].filter(Boolean)
    const progress = grantXp({
        ...account.progress,
        ...Object.fromEntries(incremented.map((name) => [name, (Number(account.progress[name]) || 0) + 1])),
        ...(progressPatch ?? {}),
    }, xp)
    const inventory = grantedTitles(progress, account.wallet.inventory)
    const wallet = {
        ...account.wallet,
        balance: account.wallet.balance + lumen,
        crateTokens: account.wallet.crateTokens + crates,
        inventory,
        ...(claimedLevels ? { claimedLevels } : {}),
    }
    transaction.set(account.userRef, { progress, badges: badgesForProgress(progress) }, { merge: true })
    transaction.set(account.walletRef, wallet, { merge: true })
    return { progress, wallet }
}

// Thresholds are the running total of RARITY_ODDS, so the published odds and the
// draw can never drift apart.
const RARITY_THRESHOLDS = Object.keys(RARITY_ODDS).reduce((result, rarity) => {
    const running = (result.at(-1)?.ceiling ?? 0) + RARITY_ODDS[rarity]
    return [...result, { rarity, ceiling: running }]
}, [])

const chooseColor = (random = randomInt) => {
    const roll = random(100)
    const rarity = RARITY_THRESHOLDS.find((entry) => roll < entry.ceiling)?.rarity ?? 'Common'
    const pool = CRATE_CATALOG.filter((item) => item.rarity === rarity)
    return pool[random(pool.length)]
}

// readAccount only ever calls `transaction.get`, so handing it this instead reads
// the same two documents without taking a transaction lock on them.
const DIRECT_READS = { get: (ref) => ref.get() }

const economySnapshot = (progress, wallet) => {
    const nextGoals = BADGE_DEFINITIONS.filter((badge) => (Number(progress[badge.counter]) || 0) < badge.target)
    const goals = [
        nextGoals.find((badge) => badge.counter === 'rankedMatches'),
        nextGoals.find((badge) => badge.counter === 'rewardedTasks'),
        nextGoals.find((badge) => ['publishedResources', 'publishedLessons', 'heartsReceived'].includes(badge.counter)),
    ].filter(Boolean).map((badge) => ({ id: badge.id, label: badge.label, current: Number(progress[badge.counter]) || 0, target: badge.target }))
    return {
        progress,
        wallet,
        badges: badgesForProgress(progress),
        goals,
        catalog: COSMETIC_CATALOG,
        defaultTitle: DEFAULT_TITLE_ID,
        earnedTitles: EARNED_TITLE_DEFINITIONS.map((entry) => ({ id: entry.id, requirement: entry.requirement })),
        starterColors: STARTER_COLORS,
        starterFaces: STARTER_FACES,
        rarityOdds: RARITY_ODDS,
        cratePrice: CRATE_PRICE,
        duplicateRefund: DUPLICATE_REFUND,
        claimable: claimableLevels(progress.level, wallet.claimedLevels),
    }
}

// Reads, and only writes when the read turned up something not yet stored.
//
// This used to be a read-write transaction unconditionally, which made the most
// frequently hit endpoint in the app contend for a lock on users/{uid} and
// wallets/{uid} with every other refresh and with the mutations themselves. A
// burst of refreshes - the client reloads the snapshot on every XP change, and
// each reward also awaits one directly - then aborted one another, and the
// client was left holding no snapshot at all. Since the roadmap, the locker and
// the crate's drop table all read a missing snapshot as an empty one, that is
// what made every level look claimable, the locker look like nothing was owned
// and the drop table lose its percentages, all at the same moment.
const getEconomySnapshot = async (userId) => {
    const account = await readAccount(DIRECT_READS, userId)
    const progress = grantXp(account.progress, 0)
    const inventory = grantedTitles(progress, account.wallet.inventory)
    const stored = account.user?.progress ?? {}

    // An earned title the student has just qualified for, or an account still on
    // an older XP curve. Both are one-offs, so they get persisted the same way
    // every other account write does rather than being re-derived on every read.
    const settled = inventory.length === account.wallet.inventory.length
        && progress.curveVersion === stored.curveVersion
        && progress.level === stored.level
        && progress.xp === stored.xp

    if(settled) return economySnapshot(progress, { ...account.wallet, inventory })

    return db.runTransaction(async (transaction) => {
        const fresh = await readAccount(transaction, userId)
        const { progress: written, wallet } = writeAccount(transaction, fresh)
        return economySnapshot(written, wallet)
    })
}

const claimLevelReward = async (userId, level) => {
    const target = Math.floor(Number(level))
    if(!Number.isInteger(target) || target < 2) throw new Error('Nothing to claim at that level.')
    return db.runTransaction(async (transaction) => {
        const account = await readAccount(transaction, userId)
        if(target > account.progress.level) throw new Error('Reach this level first.')
        if(account.wallet.claimedLevels.includes(target)) throw new Error('Already claimed.')
        const reward = levelReward(target)
        const { progress, wallet } = writeAccount(transaction, account, {
            lumen: reward.lumen,
            crates: reward.crates,
            claimedLevels: [...account.wallet.claimedLevels, target],
        })
        return { reward, progress, wallet, claimable: claimableLevels(progress.level, wallet.claimedLevels) }
    })
}

const openCrate = async (userId, operationId) => {
    if(!/^[a-zA-Z0-9_-]{8,100}$/.test(String(operationId || ''))) throw new Error('Invalid operation ID.')
    return db.runTransaction(async (transaction) => {
        const opRef = db.collection('economyOps').doc(`${userId}_crate_${operationId}`)
        const opSnap = await transaction.get(opRef)
        if(opSnap.exists) return opSnap.data().result
        const account = await readAccount(transaction, userId)
        const useToken = account.wallet.crateTokens > 0
        if(!useToken && account.wallet.balance < CRATE_PRICE) throw new Error('Not enough Lumen.')
        const rarityPath = rollCrateRarityPath(RARITY_ODDS, () => randomInt(1000000000) / 1000000000)
        const pool = CRATE_CATALOG.filter((item) => item.rarity === rarityPath.at(-1))
        const color = pool[randomInt(pool.length)]
        const duplicate = account.wallet.inventory.includes(color.id)
        const wallet = {
            ...account.wallet,
            balance: account.wallet.balance - (useToken ? 0 : CRATE_PRICE) + (duplicate ? DUPLICATE_REFUND : 0),
            crateTokens: account.wallet.crateTokens - (useToken ? 1 : 0),
            inventory: duplicate ? account.wallet.inventory : [...account.wallet.inventory, color.id],
        }
        transaction.set(account.userRef, { progress: account.progress }, { merge: true })
        transaction.set(account.walletRef, wallet, { merge: true })
        const result = { color, rarityPath, duplicate, refund: duplicate ? DUPLICATE_REFUND : 0, wallet }
        transaction.create(opRef, { userId, type: 'crate', result, createdAt: new Date() })
        return result
    })
}

const equipAvatar = async (userId, color, face) => {
    const item = COLOR_CATALOG.find((entry) => entry.value === color)
    const selectedFace = Number(face)
    const faceItem = FACE_CATALOG.find((entry) => entry.value === selectedFace)
    if(!STARTER_COLORS.includes(color) && !item) throw new Error('Unknown avatar color.')
    if(!Number.isInteger(selectedFace) || (!STARTER_FACES.includes(selectedFace) && !faceItem)) throw new Error('Unknown avatar face.')
    return db.runTransaction(async (transaction) => {
        const account = await readAccount(transaction, userId)
        if(item && !account.wallet.inventory.includes(item.id)) throw new Error('Unlock this color first.')
        if(faceItem && !account.wallet.inventory.includes(faceItem.id)) throw new Error('Unlock this face first.')
        transaction.update(account.userRef, { 'profile.avatar': { color, face: selectedFace } })
        return { color, face: selectedFace }
    })
}

// Titles are equipped on their own rather than through equipAvatar, which validates a colour and
// a face as a matched pair and has no sensible behaviour for a third independent slot.
const equipTitle = async (userId, titleId) => {
    const requested = String(titleId ?? '')
    const title = TITLE_CATALOG.find((entry) => entry.id === requested)
    if(!title) throw new Error('Unknown title.')

    return db.runTransaction(async (transaction) => {
        const account = await readAccount(transaction, userId)
        const owned = grantedTitles(account.progress, account.wallet.inventory)
        if(!owned.includes(title.id)) throw new Error('Unlock this title first.')

        transaction.update(account.userRef, { 'profile.title': title.id })
        return { title: title.id, name: title.name, rarity: title.rarity }
    })
}

const tipResource = async (senderId, resourceId, amount, operationId) => {
    if(!TIP_AMOUNTS.has(Number(amount))) throw new Error('Choose 10, 25, or 50 Lumen.')
    if(!/^[a-zA-Z0-9_-]{8,100}$/.test(String(operationId || ''))) throw new Error('Invalid operation ID.')
    return db.runTransaction(async (transaction) => {
        const opRef = db.collection('economyOps').doc(`${senderId}_tip_${operationId}`)
        const resourceRef = db.collection('resources').doc(String(resourceId || ''))
        const [opSnap, resourceSnap] = await Promise.all([transaction.get(opRef), transaction.get(resourceRef)])
        if(opSnap.exists) return opSnap.data().result
        if(!resourceSnap.exists || resourceSnap.data().status !== 'published') throw new Error('Resource unavailable.')
        const recipientId = resourceSnap.data().ownerId
        if(senderId === recipientId) throw new Error('You cannot tip your own resource.')
        const [sender, recipient] = await Promise.all([readAccount(transaction, senderId), readAccount(transaction, recipientId)])
        if(sender.wallet.balance < amount) throw new Error('Not enough Lumen.')
        const senderWallet = { ...sender.wallet, balance: sender.wallet.balance - amount }
        const recipientWallet = { ...recipient.wallet, balance: recipient.wallet.balance + amount }
        transaction.set(sender.userRef, { progress: sender.progress }, { merge: true })
        transaction.set(recipient.userRef, { progress: recipient.progress }, { merge: true })
        transaction.set(sender.walletRef, senderWallet, { merge: true })
        transaction.set(recipient.walletRef, recipientWallet, { merge: true })
        const result = { balance: senderWallet.balance, amount, resourceId }
        transaction.create(opRef, { userId: senderId, recipientId, type: 'tip', result, createdAt: new Date() })
        return result
    })
}

export {
    BADGE_DEFINITIONS, COLOR_CATALOG, COSMETIC_CATALOG, CRATE_CATALOG, DEFAULT_TITLE_ID,
    EARNED_TITLE_DEFINITIONS, EARNED_TITLE_IDS, FACE_CATALOG, RARITY_ODDS, STARTER_COLORS,
    STARTER_FACES, TITLE_CATALOG, badgesForProgress, chooseColor, claimLevelReward,
    earnedTitlesForProgress, equipAvatar, equipTitle, getEconomySnapshot, grantedTitles,
    openCrate, readAccount, tipResource, writeAccount,
}
