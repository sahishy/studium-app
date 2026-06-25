import { doc, getDoc, onSnapshot, runTransaction, setDoc } from 'firebase/firestore'
import { db } from '../../../lib/firebase'

const createUserStatsDocument = async ({ userId, schoolId = null, schoolAffiliations = [] }) => {

    if(!userId) {
        throw new Error('A valid userId is required to create user stats.')
    }

    const userStatsRef = doc(db, 'userStats', userId)

    await setDoc(userStatsRef, {
        userId,
        academic: {
            schoolId,
            schoolAffiliations: Array.isArray(schoolAffiliations) ? schoolAffiliations : [],
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
        play: {},
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

        const currentPlay = resolvedUserStatsData?.play ?? {}
        const modeStats = currentPlay?.[modeId] ?? {}

        const currentElo = Number(modeStats?.elo) || 0
        const currentPeakElo = Number(modeStats?.peakElo) || currentElo

        const nextElo = Math.max(0, currentElo + resolvedEloDelta)
        const nextPeakElo = Math.max(currentPeakElo, nextElo)

        const nextPlay = {
            ...currentPlay,
            [modeId]: {
                ...modeStats,
                elo: nextElo,
                peakElo: nextPeakElo,
                gamesPlayed: (Number(modeStats?.gamesPlayed) || 0) + 1,
            },
        }

        activeTransaction.set(userStatsRef, {
            userId,
            play: nextPlay,
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

const applySingleplayerGameResult = async ({ userId, modeId, score = 0 }) => {

    if(!userId || !modeId) {
        throw new Error('userId and modeId are required to apply singleplayer game result.')
    }

    const userStatsRef = doc(db, 'userStats', userId)
    const resolvedScore = Math.max(0, Number(score) || 0)

    await runTransaction(db, async (transactionRef) => {
        const userStatsSnap = await transactionRef.get(userStatsRef)
        const resolvedUserStatsData = userStatsSnap.exists() ? (userStatsSnap.data() ?? {}) : {}
        const currentPlay = resolvedUserStatsData?.play ?? {}
        const modeStats = currentPlay?.[modeId] ?? {}

        transactionRef.set(userStatsRef, {
            userId,
            play: {
                ...currentPlay,
                [modeId]: {
                    ...modeStats,
                    peakScore: Number(modeStats?.peakScore) > 0
                        ? Math.min(Number(modeStats?.peakScore), resolvedScore)
                        : resolvedScore,
                    gamesPlayed: (Number(modeStats?.gamesPlayed) || 0) + 1,
                },
            },
            lastUpdated: new Date(),
        }, { merge: true })
    })

}

export {
    createUserStatsDocument,
    getUserStatsByUserId,
    subscribeToUserStatsByUserId,
    updateUserStatsByUserId,
    applyRankedMatchResult,
    applySingleplayerGameResult,
}
