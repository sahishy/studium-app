import { randomInt } from 'node:crypto'
import { rollCrateRarityPath } from './crateRolls.js'
import { db } from '../../lib/firebaseAdmin.js'
import {
    CRATE_PRICE, DUPLICATE_REFUND, claimableLevels, grantXp, levelReward, normalizeProgress,
} from './progression.js'

const STARTER_COLORS = ['#fcd34d', '#22c55e', '#60a5fa', '#f87171']
const STARTER_FACES = Object.freeze([0, 1, 2])
const COLOR_CATALOG = Object.freeze([
    { id: 'orange', value: '#fb923c', rarity: 'Common' },
    { id: 'violet', value: '#a78bfa', rarity: 'Common' },
    { id: 'teal', value: '#2dd4bf', rarity: 'Common' },
    { id: 'rose', value: '#f472b6', rarity: 'Common' },
    { id: 'cyan', value: '#22d3ee', rarity: 'Uncommon' },
    { id: 'lime', value: '#a3e635', rarity: 'Uncommon' },
    { id: 'indigo', value: '#818cf8', rarity: 'Uncommon' },
    { id: 'peach', value: '#fdba74', rarity: 'Uncommon' },
    { id: 'gold', value: '#eab308', rarity: 'Rare' },
    { id: 'crimson', value: '#dc2626', rarity: 'Rare' },
    { id: 'emerald', value: '#059669', rarity: 'Rare' },
    { id: 'obsidian', value: '#334155', rarity: 'Epic' },
    { id: 'pearl', value: '#e2e8f0', rarity: 'Epic' },
    { id: 'black', value: '#0b0b0e', rarity: 'Legendary' },
])

// Faces drop from the same crate as colours. Their ids are prefixed so one
// inventory can hold both without collisions.
const FACE_CATALOG = Object.freeze([
    { id: 'face-5', value: 5, name: 'Smile', rarity: 'Common' },
    { id: 'face-4', value: 4, name: 'Meh', rarity: 'Common' },
    { id: 'face-6', value: 6, name: 'Wink', rarity: 'Uncommon' },
    { id: 'face-13', value: 13, name: 'Chill', rarity: 'Uncommon' },
    { id: 'face-7', value: 7, name: 'Joyful', rarity: 'Uncommon' },
    { id: 'face-8', value: 8, name: 'Flustered', rarity: 'Rare' },
    { id: 'face-9', value: 9, name: 'Shocked', rarity: 'Rare' },
    { id: 'face-12', value: 12, name: 'Dreadful', rarity: 'Rare' },
    { id: 'face-11', value: 11, name: 'Confused', rarity: 'Epic' },
    { id: 'face-3', value: 3, name: 'Goofy', rarity: 'Epic' },
    { id: 'face-10', value: 10, name: 'Alien', rarity: 'Legendary' },
])

const COSMETIC_CATALOG = Object.freeze([
    ...COLOR_CATALOG.map((item) => ({ ...item, type: 'color' })),
    ...FACE_CATALOG.map((item) => ({ ...item, type: 'face' })),
])
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
    }
    return { userRef, walletRef, user, progress, wallet }
}

const badgesForProgress = (progress) => BADGE_DEFINITIONS.filter((badge) => (Number(progress[badge.counter]) || 0) >= badge.target).map((badge) => badge.id)

const writeAccount = (transaction, account, { xp = 0, lumen = 0, crates = 0, counter = null, claimedLevels = null } = {}) => {
    const progress = grantXp({
        ...account.progress,
        ...(counter ? { [counter]: (Number(account.progress[counter]) || 0) + 1 } : {}),
    }, xp)
    const wallet = {
        ...account.wallet,
        balance: account.wallet.balance + lumen,
        crateTokens: account.wallet.crateTokens + crates,
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
    const pool = COSMETIC_CATALOG.filter((item) => item.rarity === rarity)
    return pool[random(pool.length)]
}

const getEconomySnapshot = async (userId) => db.runTransaction(async (transaction) => {
    const account = await readAccount(transaction, userId)
    const { progress, wallet } = writeAccount(transaction, account)
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
        starterColors: STARTER_COLORS,
        starterFaces: STARTER_FACES,
        rarityOdds: RARITY_ODDS,
        cratePrice: CRATE_PRICE,
        duplicateRefund: DUPLICATE_REFUND,
        claimable: claimableLevels(progress.level, wallet.claimedLevels),
    }
})

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
        const pool = COSMETIC_CATALOG.filter((item) => item.rarity === rarityPath.at(-1))
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

export { BADGE_DEFINITIONS, COLOR_CATALOG, COSMETIC_CATALOG, FACE_CATALOG, RARITY_ODDS, STARTER_COLORS, STARTER_FACES, badgesForProgress, chooseColor, claimLevelReward, equipAvatar, getEconomySnapshot, openCrate, readAccount, tipResource, writeAccount }
