import { collection, query, where, onSnapshot, addDoc, getDocs, doc, updateDoc, getDoc, getCountFromServer, writeBatch, increment } from 'firebase/firestore'
import { useEffect, useState } from 'react';
import { db } from '../../../lib/firebase';
import { createCacheKey, deleteCacheEntry, getCacheStatus, getCacheValue, setCacheEntry, CACHE_STATUS } from '../../../shared/services/cacheService';
import { CACHE_NAMESPACES, CACHE_TTLS_MS } from '../../../shared/utils/cacheUtils';
import { getUserStatsByUserId } from '../../profile/services/statsService';
import { getTotalElo } from '../../profile/utils/statsUtils';
import { getCompetitiveCircle } from '../utils/circleUtils';

const CIRCLES_UPDATED_EVENT = 'socials:circles-updated';
const getUserCirclesCacheKey = (userId) => {
    return createCacheKey(CACHE_NAMESPACES.SOCIALS_USER_CIRCLES, userId);
};

const emitCirclesUpdated = () => {
    if(typeof window !== 'undefined') {
        window.dispatchEvent(new Event(CIRCLES_UPDATED_EVENT));
    }
}

const getUserTotalElo = async (uid) => {
    const userStats = await getUserStatsByUserId(uid)
    return Number(getTotalElo(userStats)) || 0
}

const getUserCircles = async (userId) => {
    if(!userId) {
        return []
    }

    const circlesRef = collection(db, 'circles')
    const snapshot = await getDocs(circlesRef)
    const circlesData = snapshot.docs.map((circleDoc) => ({ uid: circleDoc.id, ...circleDoc.data() }))

    const membershipChecks = await Promise.all(
        circlesData.map(async (circle) => {
            const memberRef = doc(db, 'circles', circle.uid, 'members', userId)
            const memberSnap = await getDoc(memberRef)
            return memberSnap.exists() ? circle : null
        })
    )

    return membershipChecks.filter(Boolean)
}

const createCircle = async (uid, circleData) => {

    const circlesRef = collection(db, 'circles')

    const generateCircleCode = async () => {
        let codeCharacters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ23456789';
        let code = '';

        while(code.length < 6) {
            code += codeCharacters[Math.floor(Math.random() * codeCharacters.length)]
        }

        const q = query(circlesRef, where("inviteCode", "==", code));
        const querySnapshot = await getDocs(q);

        if(!querySnapshot.empty) {
            return generateCircleCode();
        } else {
            return code;
        }
    }

    const generatedCode = await generateCircleCode();
    const now = new Date()

    const userCircles = await getUserCircles(uid)
    if(circleData.type === 'competitive' && getCompetitiveCircle(userCircles)) {
        throw new Error('You can only be in one competitive circle at a time.')
    }

    const creatorTotalElo = await getUserTotalElo(uid)

    const circle = {
        type: circleData.type,
        profile: circleData.profile,
        inviteCode: generatedCode,
        memberCount: 1,
        totalElo: creatorTotalElo,
        level: 1,
        xp: 0,
        createdAt: now,
        updatedAt: now,
        createdByUserId: uid,
        createdBy: uid,
    }

    const circleRef = doc(circlesRef)
    const batch = writeBatch(db)

    batch.set(circleRef, circle)

    const memberRef = doc(db, 'circles', circleRef.id, 'members', uid)
    batch.set(memberRef, {
        role: 'owner',
        joinedAt: now
    })

    await batch.commit()

    const cacheKey = getUserCirclesCacheKey(uid)
    const cachedCircles = getCacheValue(cacheKey)
    if(Array.isArray(cachedCircles)) {
        setCacheEntry(cacheKey, [{ uid: circleRef.id, ...circle }, ...cachedCircles], {
            ttlMs: CACHE_TTLS_MS.SOCIALS_USER_CIRCLES,
        })
    }

    emitCirclesUpdated()

    return circleRef

}

const joinCircle = async (uid, circleId) => {
    const userCircles = await getUserCircles(uid)
    const targetCircle = await getCircle(circleId)

    if(!targetCircle) {
        throw new Error('Circle not found.')
    }

    if(targetCircle.type === 'competitive') {
        const currentCompetitiveCircle = getCompetitiveCircle(userCircles)
        if(currentCompetitiveCircle && currentCompetitiveCircle.uid !== circleId) {
            throw new Error('You can only be in one competitive circle at a time.')
        }
    }
    
    const circleRef = doc(db, 'circles', circleId)
    const now = new Date()
    const batch = writeBatch(db)
    const userTotalElo = await getUserTotalElo(uid)

    batch.update(circleRef, {
        memberCount: increment(1),
        totalElo: increment(userTotalElo),
        updatedAt: now
    })

    const memberRef = doc(db, 'circles', circleId, 'members', uid)
    batch.set(memberRef, {
        role: 'member',
        joinedAt: now
    }, { merge: true })

    await batch.commit()

    deleteCacheEntry(getUserCirclesCacheKey(uid))
    emitCirclesUpdated()

}

const leaveCircle = async (uid, circleId) => {

    const circleRef = doc(db, 'circles', circleId)
    const now = new Date()
    const batch = writeBatch(db)
    const userTotalElo = await getUserTotalElo(uid)

    batch.update(circleRef, {
        memberCount: increment(-1),
        totalElo: increment(-userTotalElo),
        updatedAt: now
    })

    const memberRef = doc(db, 'circles', circleId, 'members', uid)
    batch.delete(memberRef)

    await batch.commit()

    const cacheKey = getUserCirclesCacheKey(uid)
    const cachedCircles = getCacheValue(cacheKey)
    if(Array.isArray(cachedCircles)) {
        setCacheEntry(cacheKey, cachedCircles.filter((circle) => circle.uid !== circleId), {
            ttlMs: CACHE_TTLS_MS.SOCIALS_USER_CIRCLES,
        })
    } else {
        deleteCacheEntry(cacheKey)
    }

    emitCirclesUpdated()

}

const updateCircle = async (circleId, circleData) => {
    const circleRef = doc(db, 'circles', circleId)
    await updateDoc(circleRef, circleData)
}

const canJoinCircle = async (uid, inviteCode) => {

    const circlesRef = collection(db, 'circles');

    const q = query(circlesRef, where('inviteCode', '==', inviteCode))
    const querySnapshot = await getDocs(q);

    if(querySnapshot.empty) {
        return { circleId: null, canJoin: false }
    }

    const circle = querySnapshot.docs[0];
    const circleData = circle.data()
    const memberRef = doc(db, 'circles', circle.id, 'members', uid)
    const memberSnap = await getDoc(memberRef)
    const userAlreadyInCircle = memberSnap.exists()

    const userCircles = await getUserCircles(uid)
    const currentCompetitiveCircle = getCompetitiveCircle(userCircles)
    const blockedByCompetitiveLimit = circleData?.type === 'competitive' && currentCompetitiveCircle && currentCompetitiveCircle.uid !== circle.id

    return {
        circleId: circle.id,
        canJoin: !userAlreadyInCircle && !blockedByCompetitiveLimit,
        reason: userAlreadyInCircle ? 'already_member' : blockedByCompetitiveLimit ? 'competitive_limit' : null,
    }

}

const getCircle = async (circleId) => {

    const circleRef = doc(db, 'circles', circleId)
    const circleSnap = await getDoc(circleRef);

    return circleSnap.exists() ? { uid: circleSnap.id, ...circleSnap.data() } : null

}

const getTotalCircles = async () => {

    const circles = collection(db, 'circles');
    const totalCirclesSnapshot = await getCountFromServer(circles);

    return totalCirclesSnapshot.data().count

}

const useCircle = (circleId) => {

    const [circle, setCircle] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if(!circleId) return;

        const ref = doc(db, 'circles', circleId);
        const unsubscribe = onSnapshot(ref, (snap) => {
            if(snap.exists()) {
                setCircle({ uid: snap.id, ...snap.data() });
            } else {
                setCircle(null);
            }
            setLoading(false);
        });
        return unsubscribe;
    }, [circleId]);

    return { circle, loading };

}

const useUserCircles = (userId) => {

    const [circles, setCircles] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if(!userId) {
            setCircles([]);
            setLoading(false);
            return;
        }

        const cacheKey = getUserCirclesCacheKey(userId)
        const cacheStatus = getCacheStatus(cacheKey)
        const cachedValue = getCacheValue(cacheKey)

        if(cacheStatus === CACHE_STATUS.FRESH && Array.isArray(cachedValue)) {
            setCircles(cachedValue)
            setLoading(false)
        } else if(Array.isArray(cachedValue)) {
            setCircles(cachedValue)
        }

        let isMounted = true

        const fetchCircles = async () => {
            const circlesRef = collection(db, 'circles')
            const snapshot = await getDocs(circlesRef)
            const circlesData = snapshot.docs.map((circleDoc) => ({ uid: circleDoc.id, ...circleDoc.data() }))

            if(!circlesData.length) {
                if(!isMounted) return
                setCircles([])
                setCacheEntry(cacheKey, [], { ttlMs: CACHE_TTLS_MS.SOCIALS_USER_CIRCLES })
                setLoading(false)
                return
            }

            const membershipChecks = await Promise.all(
                circlesData.map(async (circle) => {
                    const memberRef = doc(db, 'circles', circle.uid, 'members', userId)
                    const memberSnap = await getDoc(memberRef)
                    return memberSnap.exists() ? circle : null
                })
            )

            const nextCircles = membershipChecks.filter(Boolean)
            setCacheEntry(cacheKey, nextCircles, { ttlMs: CACHE_TTLS_MS.SOCIALS_USER_CIRCLES })

            if(!isMounted) return
            setCircles(nextCircles)
            setLoading(false)
        }

        fetchCircles()

        const handleCirclesUpdated = () => {
            fetchCircles()
        }

        window.addEventListener(CIRCLES_UPDATED_EVENT, handleCirclesUpdated)

        return () => {
            isMounted = false
            window.removeEventListener(CIRCLES_UPDATED_EVENT, handleCirclesUpdated)
        }
    }, [userId]);

    return { circles, loading };

}

const useCircleMembers = (circleId) => {
    
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if(!circleId) {
            setMembers([]);
            setLoading(false);
            return;
        }

        const membersRef = collection(db, 'circles', circleId, 'members');

        const unsubscribe = onSnapshot(membersRef, (snapshot) => {
            const data = snapshot.docs.map((memberDoc) => ({
                userId: memberDoc.id,
                ...memberDoc.data()
            }));

            setMembers(data);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [circleId]);

    return { members, loading };

}

const useCircleMemberIds = (circleIds = []) => {

    const [memberIds, setMemberIds] = useState([]);

    useEffect(() => {
        if(!circleIds.length) {
            setMemberIds([]);
            return;
        }

        const unsubscribes = [];
        const batches = [];

        circleIds.forEach((circleId, index) => {
            const membersRef = collection(db, 'circles', circleId, 'members');

            const unsubscribe = onSnapshot(membersRef, (snapshot) => {
                batches[index] = snapshot.docs.map((memberDoc) => memberDoc.id);
                const merged = batches.flat();
                const unique = [...new Set(merged)];
                setMemberIds(unique);
            });

            unsubscribes.push(unsubscribe);
        });

        return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
    }, [circleIds.join(',')]);

    return memberIds;

}

export { createCircle, joinCircle, leaveCircle, updateCircle, canJoinCircle, getCircle, getTotalCircles, getUserCircles, useCircle, useUserCircles, useCircleMembers, useCircleMemberIds }