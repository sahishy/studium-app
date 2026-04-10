import { doc, getDoc, getFirestore, onSnapshot, setDoc } from 'firebase/firestore'

const createUserStatsDocument = async ({ userId }) => {

    if(!userId) {
        throw new Error('A valid userId is required to create user stats.')
    }

    const db = getFirestore()
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

    const db = getFirestore()
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

    const db = getFirestore()
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

    const db = getFirestore()
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
