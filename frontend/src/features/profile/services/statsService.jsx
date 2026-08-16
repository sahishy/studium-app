import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore'
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

export {
    createUserStatsDocument,
    getUserStatsByUserId,
    subscribeToUserStatsByUserId,
    updateUserStatsByUserId,
}
