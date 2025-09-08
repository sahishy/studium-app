import { doc, updateDoc, deleteDoc, getFirestore, collection, addDoc, onSnapshot, where, query, setDoc, getDoc, getDocs, writeBatch } from 'firebase/firestore'
import { useEffect, useState, useMemo } from 'react';

const colors = [
    { name: 'gray', textStyle: 'text-text2', bgStyle: 'bg-background3' },
    { name: 'red', textStyle: 'text-red-400',  bgStyle: 'bg-red-400/15' },
    { name: 'orange', textStyle: 'text-orange-400',  bgStyle: 'bg-orange-400/15' },
    { name: 'yellow', textStyle: 'text-yellow-400', bgStyle: 'bg-yellow-400/15' },
    { name: 'green', textStyle: 'text-emerald-400', bgStyle: 'bg-emerald-400/15' },
    { name: 'blue', textStyle: 'text-sky-400', bgStyle: 'bg-sky-400/15' },
    { name: 'purple', textStyle: 'text-fuchsia-400', bgStyle: 'bg-fuchsia-400/15' },
]
const googlePatterns = [
    { type: 'document', regex: /https?:\/\/docs\.google\.com\/document\/d\/([^/]+)/ },
    { type: 'spreadsheet', regex: /https?:\/\/docs\.google\.com\/spreadsheets\/d\/([^/]+)/ },
    { type: 'presentation', regex: /https?:\/\/docs\.google\.com\/presentation\/d\/([^/]+)/ },
    { type: 'form', regex: /https?:\/\/docs\.google\.com\/forms\/d\/([^/]+)/ },
    { type: 'drawing', regex: /https?:\/\/docs\.google\.com\/drawings\/d\/([^/]+)/ },
    { type: 'driveFile', regex: /https?:\/\/drive\.google\.com\/file\/d\/([^/]+)/ }
];

const formatUrl = (url) => {
    let link = url;
    if(!link.includes('http')) {
        link = 'http://' + link;
    }
    return link;
}

const extractGoogleFileInfo = (url) => {

    for(let { type, regex } of googlePatterns) {
        const m = url.match(regex);
        if(m) {
            return { type, id: m[1] };
        }
    }

    return null;

}
  

const getColor = (name) => {
    return colors.find(x => x.name === name);
}

const getColors = () => {
    return colors;
}

const createSubject = async ( { userId, circleId, subjectData } ) => {

    const db = getFirestore();
    const collectionRef = collection(db, 'subjects')

    const subject = {
        title: subjectData.title,
        day: subjectData.day,
        color: subjectData.color,
        link: subjectData.link,
        createdAt: new Date(),
        userId: (userId ? userId : null),
        circleId: (circleId ? circleId : null)
    }  

    await addDoc(collectionRef, subject)
}

const updateSubject = async (subjectId, subjectData) => {
    const db = getFirestore()
    const subjectRef = doc(db, 'subjects', subjectId)

    await updateDoc(subjectRef, subjectData)
}

const deleteSubject = async (subjectId) => {
    const db = getFirestore()

    const subjectRef = doc(db, 'subjects', subjectId)

    await deleteDoc(subjectRef);
}

const deleteCircleSubjects = async (circleId) => {

    const db = getFirestore()
    const subjectsRef = collection(db, 'subjects')
    const q = query(subjectsRef, where('circleId', '==', circleId))
  
    const snapshot = await getDocs(q)
    if(snapshot.empty) {
        console.log('No subjects to delete for circle', circleId)
        return
    }
  
    const batches = []
    let batch = writeBatch(db)
    let opCount = 0
  
    snapshot.docs.forEach(docSnap => {
        batch.delete(docSnap.ref)
        opCount++
  
        if(opCount === 500) {
            batches.push(batch.commit())
            batch = writeBatch(db)
            opCount = 0
        }
    })
  
    if(opCount > 0) {
        batches.push(batch.commit())
    }
  
    await Promise.all(batches)

}

function useUserSubjects(userId) {
    const [personalSubjects, setPersonalSubjects] = useState([]);
  
    useEffect(() => {
        if(!userId) {
            setPersonalSubjects([]);
            return;
        }
    
        const db = getFirestore();
        const subjectsRef = collection(db, 'subjects');
        const q = query(subjectsRef, where('userId', '==', userId));
    
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
            uid: doc.id,
            ...doc.data()
            }));
            setPersonalSubjects(data);
        });
    
        return () => unsubscribe();
        }, [userId]);
    
    return personalSubjects;
}

const useCircleSubjects = (circleIds = []) => {

    const [circleSubjects, setCircleSubjects] = useState([]);

    const validIds = useMemo(
        () => circleIds.filter(id => typeof id === 'string'),
        [circleIds.join(',')]
    );

    useEffect(() => {

        if(!validIds.length) {
            setCircleSubjects([]);
            return;
        }
  
        const db = getFirestore();
        const unsubscribes = [];
        const batches = [];
        const BATCH_SIZE = 10;
  
        for(let i = 0; i < validIds.length; i += BATCH_SIZE) {

            const chunk = validIds.slice(i, i + BATCH_SIZE);
            const subjectsRef = collection(db, 'subjects');
            const q = query(subjectsRef, where('circleId', 'in', chunk));
    
            const unsub = onSnapshot(q, snapshot => {
                
                batches[i / BATCH_SIZE] = snapshot.docs.map(doc => ({
                    uid: doc.id,
                    ...doc.data(),
                }));

                const allSubjects = batches.flat();
                setCircleSubjects(allSubjects); 
            })
  
            unsubscribes.push(unsub);
        }
  
        return () => unsubscribes.forEach(unsubscribe => unsubscribe())

    }, [validIds])
  
    return circleSubjects

}

export { 
    createSubject, 
    updateSubject, 
    deleteSubject,
    deleteCircleSubjects,
    getColor, 
    getColors,
    extractGoogleFileInfo,
    formatUrl,
    useUserSubjects,
    useCircleSubjects
};