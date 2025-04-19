import { getFirestore, collection, query, where, onSnapshot, addDoc, getDocs, doc, updateDoc, getDoc, deleteDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react';
import { deleteCircleSubjects } from './subjectUtils';
import { deleteCircleTasks } from './taskUtils';

const createCircle = async ( uid, circleData ) => {

    const db = getFirestore();
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

    const circle = {
        title: circleData.title,
        inviteCode: generatedCode,
        userIds: [uid],
        level: 1,
        xp: 0,
        createdAt: new Date(),
        createdBy: uid,
    }  

    const circleRef = await addDoc(circlesRef, circle)

    await updateDoc(circleRef, {
        uid: circleRef.id
    })

}

const joinCircle = async ( uid, circleId ) => {

    const db = getFirestore()
    const circleRef = doc(db, 'circles', circleId)
    const circleSnapshot = await getDoc(circleRef);

    await updateDoc(circleRef, {
        userIds: [...circleSnapshot.data().userIds, uid]
    })

}

const leaveCircle = async ( uid, circleId ) => {

    const db = getFirestore()
    const circleRef = doc(db, 'circles', circleId)
    const circleSnapshot = await getDoc(circleRef);

    await updateDoc(circleRef, {
        userIds: [...circleSnapshot.data().userIds].filter(x => x !== uid)
    })

}

const updateCircle = async (circleId, circleData) => {
    const db = getFirestore()
    const circleRef = doc(db, 'circles', circleId)

    await updateDoc(circleRef, circleData)
}

const canJoinCircle = async ( uid, inviteCode ) => {
    const db = getFirestore()
    const circlesRef = collection(db, 'circles');

    const q = query(circlesRef, where('inviteCode', '==', inviteCode))
    const querySnapshot = await getDocs(q);

    if(querySnapshot.empty) {
        return { circleId: null, canJoin: false }
    }

    const circle = querySnapshot.docs[0];
    const userAlreadyInCircle = circle.data().userIds.includes(uid);

    return { circleId: circle.id, canJoin: !userAlreadyInCircle }

}

const getCircle = async ( circleId ) => {
    const db = getFirestore() 
    const circleRef = doc(db, 'circles', circleId)
    const circleSnap = await getDoc(circleRef);
    return circleSnap.data()
}

const useCircle = (circleId) => {

    const [circle, setCircle] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!circleId) return;
    
        const db = getFirestore();
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

    useEffect(() => {
        if(!userId) {
            setCircles([]);
            return;
        }

        const db = getFirestore();
        const circlesRef = collection(db, 'circles');
        const q = query(circlesRef, where('userIds', 'array-contains', userId));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
            setCircles(data);
        });

        return () => unsubscribe()

    }, [userId]);

    return circles;
}

export { createCircle, joinCircle, leaveCircle, updateCircle, canJoinCircle, getCircle, useCircle, useUserCircles }