import { collection, query, where, onSnapshot, addDoc, getDocs, doc, updateDoc, getDoc, getCountFromServer, writeBatch, increment } from 'firebase/firestore'
import { useEffect, useState } from 'react';
import { db } from '../../../lib/firebase';

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

    const circle = {
        title: circleData.title,
        inviteCode: generatedCode,
        memberCount: 1,
        level: 1,
        xp: 0,
        createdAt: now,
        updatedAt: now,
        createdByUserId: uid,
        createdBy: uid,
    }

    const circleRef = await addDoc(circlesRef, circle)
    const batch = writeBatch(db)

    const memberRef = doc(db, 'circles', circleRef.id, 'members', uid)
    batch.set(memberRef, {
        role: 'owner',
        joinedAt: now
    })

    await batch.commit()

    return circleRef

}

const joinCircle = async (uid, circleId) => {
    
    const circleRef = doc(db, 'circles', circleId)
    const now = new Date()
    const batch = writeBatch(db)

    batch.update(circleRef, {
        memberCount: increment(1),
        updatedAt: now
    })

    const memberRef = doc(db, 'circles', circleId, 'members', uid)
    batch.set(memberRef, {
        role: 'member',
        joinedAt: now
    }, { merge: true })

    await batch.commit()

}

const leaveCircle = async (uid, circleId) => {

    const circleRef = doc(db, 'circles', circleId)
    const now = new Date()
    const batch = writeBatch(db)

    batch.update(circleRef, {
        memberCount: increment(-1),
        updatedAt: now
    })

    const memberRef = doc(db, 'circles', circleId, 'members', uid)
    batch.delete(memberRef)

    await batch.commit()

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
    const memberRef = doc(db, 'circles', circle.id, 'members', uid)
    const memberSnap = await getDoc(memberRef)
    const userAlreadyInCircle = memberSnap.exists()

    return { circleId: circle.id, canJoin: !userAlreadyInCircle }

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
            return;
        }

        const circlesRef = collection(db, 'circles');

        const unsubscribe = onSnapshot(circlesRef, async (snapshot) => {
            const circlesData = snapshot.docs.map((circleDoc) => ({ uid: circleDoc.id, ...circleDoc.data() }));

            if(!circlesData.length) {
                setCircles([]);
                setLoading(false);
                return;
            }

            const membershipChecks = await Promise.all(
                circlesData.map(async (circle) => {
                    const memberRef = doc(db, 'circles', circle.uid, 'members', userId);
                    const memberSnap = await getDoc(memberRef);
                    return memberSnap.exists() ? circle : null;
                })
            );

            setCircles(membershipChecks.filter(Boolean));
            setLoading(false);
        });

        return () => unsubscribe()
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

export { createCircle, joinCircle, leaveCircle, updateCircle, canJoinCircle, getCircle, getTotalCircles, useCircle, useUserCircles, useCircleMembers, useCircleMemberIds }