import { doc, getDoc, onSnapshot, runTransaction, setDoc } from 'firebase/firestore'
import { db } from '../../../lib/firebase'

const createUserStatsDocument = async ({ userId }) => {

    if(!userId) {
        throw new Error('A valid userId is required to create user stats.')
    }

    const userStatsRef = doc(db, 'userStats', userId)

    await setDoc(userStatsRef, {
        userId,
        academic: {
            schoolId: null,
            schoolAffiliations: [],
            targetMajors: [],
            scores: {
                sat: null,
                act: null,
            },
            gpa: {
                unweighted: null,
                weighted: null,
            },
            extracurriculars: [],
            awards: [],
            college: {
                committed: null,
                acceptances: [],
            },
        },
        ranked: {},
        lastUpdated: new Date(),
    }, { merge: true })

}

const getUserStatsByUserId = async (userId) => {

    if(!userId) {
        return null
    }

    const userStatsRef = doc(db, 'userStats', userId)
    const userStatsSnap = await getDoc(userStatsRef)

    if(!userStatsSnap.exists()) {
        return null
    }

    return {
        uid: userStatsSnap.id,
        ...userStatsSnap.data(),
    }

}

const subscribeToUserStatsByUserId = (userId, setUserStats, setLoading = () => {}, setError = () => {}) => {

    if(!userId) {
        setUserStats(null)
        setLoading(false)
        return () => {}
    }

    const userStatsRef = doc(db, 'userStats', userId)

    const unsubscribe = onSnapshot(userStatsRef, (docSnap) => {
        if(docSnap.exists()) {
            setUserStats({
                uid: docSnap.id,
                ...docSnap.data(),
            })
        } else {
            setUserStats(null)
        }

        setError(null)
        setLoading(false)
    }, (error) => {
        setError(error)
        setLoading(false)
    })

    return unsubscribe

}

const updateUserStatsByUserId = async (userId, userStatsData) => {

    if(!userId) {
        throw new Error('A valid userId is required to update user stats.')
    }

    const userStatsRef = doc(db, 'userStats', userId)

    await setDoc(userStatsRef, {
        ...userStatsData,
        userId,
        lastUpdated: new Date(),
    }, { merge: true })
    
}

const applyRankedMatchResult = async ({
    userId,
    modeId,
    eloDelta = 0,
    transaction = null,
    userStatsData = null,
}) => {

    if(!userId || !modeId) {
        throw new Error('userId and modeId are required to apply ranked match result.')
    }

    const resolvedEloDelta = Number(eloDelta) || 0
    if(!resolvedEloDelta) {
        return
    }

    const userStatsRef = doc(db, 'userStats', userId)

    const applyUpdate = async (activeTransaction) => {
        let resolvedUserStatsData = userStatsData

        if(!resolvedUserStatsData || typeof resolvedUserStatsData !== 'object') {
            const userStatsSnap = await activeTransaction.get(userStatsRef)
            resolvedUserStatsData = userStatsSnap.exists() ? (userStatsSnap.data() ?? {}) : {}
        }

        const currentRanked = resolvedUserStatsData?.ranked ?? {}
        const modeStats = currentRanked?.[modeId] ?? {}

        const currentElo = Number(modeStats?.elo) || 0
        const currentPeakElo = Number(modeStats?.peakElo) || currentElo

        const nextElo = Math.max(0, currentElo + resolvedEloDelta)
        const nextPeakElo = Math.max(currentPeakElo, nextElo)

        const nextRanked = {
            ...currentRanked,
            [modeId]: {
                ...modeStats,
                elo: nextElo,
                peakElo: nextPeakElo,
            },
        }

        activeTransaction.set(userStatsRef, {
            userId,
            ranked: nextRanked,
            lastUpdated: new Date(),
        }, { merge: true })
    }

    if(transaction) {
        await applyUpdate(transaction)
        return
    }

    await runTransaction(db, async (transactionRef) => {
        await applyUpdate(transactionRef)
    })

}

export {
    createUserStatsDocument,
    getUserStatsByUserId,
    subscribeToUserStatsByUserId,
    updateUserStatsByUserId,
    applyRankedMatchResult,
}
