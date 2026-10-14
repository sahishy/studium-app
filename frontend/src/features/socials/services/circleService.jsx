import { post, request } from '../../../shared/services/apiService'
import { collection, query, where, onSnapshot, getDocs, doc, getDoc, getCountFromServer } from 'firebase/firestore'
import { useEffect, useState } from 'react';
import { db } from '../../../lib/firebase';
import { createCacheKey, getCacheStatus, getCacheValue, setCacheEntry, CACHE_STATUS } from '../../../shared/services/cacheService';
import { CACHE_NAMESPACES, CACHE_TTLS_MS } from '../../../shared/utils/cacheUtils';


const CIRCLES_UPDATED_EVENT = 'socials:circles-updated';
const getUserCirclesCacheKey = (userId) => {
    return createCacheKey(CACHE_NAMESPACES.SOCIALS_USER_CIRCLES, userId);
};

const emitCirclesUpdated = () => {
    if(typeof window !== 'undefined') {
        window.dispatchEvent(new Event(CIRCLES_UPDATED_EVENT));
    }
}

const getUserCircles = async (userId) => {
    if(!userId) {
        return []
    }

    const result = await request({path:'/v1/circles'})
    return result.circles

}

const membershipAction = async (action, circleId, profile) => {
    const result = await post('/v1/circles/membership', { action, circleId, profile })
    emitCirclesUpdated()
    return result
}
const createCircle = async (uid, data) => {
    const result = await membershipAction('create', null, data.profile)
    return { id: result.circleId }
}
const joinCircle = (uid, circleId) => membershipAction('join', circleId)
const leaveCircle = (uid, circleId) => membershipAction('leave', circleId)
const updateCircle = async (circleId, data) => {
    const profile = Object.fromEntries(Object.entries(data).map(([key,value]) => [key.replace(/^profile\./,''),value]))
    await post(`/v1/circles/${circleId}/identity`, {profile})
    emitCirclesUpdated()
}
const setPrimaryCircle = circleId => post('/v1/circles/primary', {circleId})

const canJoinCircle = async (uid, inviteCode) => {

    const circlesRef = collection(db, 'circles');

    const q = query(circlesRef, where('inviteCode', '==', inviteCode))
    const querySnapshot = await getDocs(q);

    if(querySnapshot.empty) {
        return { circleId: null, canJoin: false }
    }

    const circle = querySnapshot.docs[0];
    const memberRef = doc(db, 'circles', circle.id, 'members', uid)
    const memberSnap = await getDoc(memberRef)
    const userAlreadyInCircle = memberSnap.exists()


    return {
        circleId: circle.id,
        canJoin: !userAlreadyInCircle,
        reason: userAlreadyInCircle ? 'already_member' : null,
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
        if(!circleId) { setCircle(null); setLoading(false); return; }

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
    const [confirmed, setConfirmed] = useState(false);

    useEffect(() => {
        setConfirmed(false);
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
            let nextCircles
            try { nextCircles = await getUserCircles(userId) }
            catch(error) { console.error('Could not load Circles',error); if(isMounted)setLoading(false); return }
            setCacheEntry(cacheKey, nextCircles, { ttlMs: CACHE_TTLS_MS.SOCIALS_USER_CIRCLES })

            if(!isMounted) return
            setCircles(nextCircles)
            setConfirmed(true)
            setLoading(false)
        }

        fetchCircles()
        const interval = setInterval(fetchCircles,30000)

        const handleCirclesUpdated = () => {
            fetchCircles()
        }

        window.addEventListener(CIRCLES_UPDATED_EVENT, handleCirclesUpdated)

        return () => {
            isMounted = false
            clearInterval(interval)
            window.removeEventListener(CIRCLES_UPDATED_EVENT, handleCirclesUpdated)
        }
    }, [userId]);

    return { circles, loading, confirmed };

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

export { setPrimaryCircle, createCircle, joinCircle, leaveCircle, updateCircle, canJoinCircle, getCircle, getTotalCircles, getUserCircles, useCircle, useUserCircles, useCircleMembers, useCircleMemberIds }