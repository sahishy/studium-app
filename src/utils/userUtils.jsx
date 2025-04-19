import { doc, updateDoc, collection, getAggregateFromServer, getCountFromServer, getFirestore, onSnapshot, query, sum, where, increment, documentId, getDoc, getDocs } from 'firebase/firestore'
import { useEffect, useState } from 'react';

const createNewUserObject = ( { uid, firstName, lastName, email } ) => {
    return {
        uid: uid,
        firstName: firstName,
        lastName: lastName,
        email: email,
        createdAt: new Date(),
        level: 1,
        xp: 0,
        streak: 0,
        currentTask: null,
        tasksCompleted: 0,
    }
}

const getActiveUserCount = (setActiveUserCount) => {

    const db = getFirestore();
    const users = collection(db, 'users')

    const activeUsersQuery = query(users, where('status', '==', 'active'))

    const unsubscribe = onSnapshot(activeUsersQuery, (querySnapshot) => {
        setActiveUserCount(querySnapshot.size);
    })

    return unsubscribe;

}

const getTotalUsers = async () => {

    const db = getFirestore();
    const users = collection(db, 'users');

    const totalUsersSnapshot = await getCountFromServer(users);

    return totalUsersSnapshot.data().count

}

const getTotalTasksCompleted = async () => {

    const db = getFirestore();
    const users = collection(db, 'users');

    const totalTasksCompletedSnapshot = await getAggregateFromServer(users, {
        totalTasksCompleted: sum('tasksCompleted')
    });

    return totalTasksCompletedSnapshot.data().totalTasksCompleted

}

const userCompleteTask = async ( profile ) => {

    const db = getFirestore();
    const userRef = doc(db, 'users', profile.uid)

    await updateDoc(userRef, {
        tasksCompleted: profile.tasksCompleted + 1
    })

}

const updateCurrentTask = async ( uid, task ) => {

    const db = getFirestore();

    const userRef = doc(db, 'users', uid) 

    if(task != null) {

        await updateDoc(userRef, {
            currentTask: task
        })

    } else {

        const collectionRef = collection(db, 'tasks')
        const q = query(collectionRef, where('userId', '==', uid), where('status', '==', 'In Progress'))
        const querySnapshot = await getDocs(q);
        
        if(!querySnapshot.empty) {

            await updateDoc(userRef, {
                currentTask: querySnapshot.docs[0].data()
            })

        } else {

            await updateDoc(userRef, {
                currentTask: null
            })

        }

    }

}

const updateStatus = async ( profile, status ) => {

    const db = getFirestore();
    const userRef = doc(db, 'users', profile.uid);

    await updateDoc(userRef, {
        lastSeen: new Date(),
        status: status
    })

}

const updateStreak = async ( profile, reset = false ) => {

    const db = getFirestore();
    const docRef = doc(db, 'users', profile.uid);

    if(reset) {
        await updateDoc(docRef, { streak: 0 });
    } else {
        await updateDoc(docRef, { streak: increment(1) });
    }

}

const getUsersByIds = ( userIds, setUsers ) => {

    const db = getFirestore();
    const usersRef = collection(db, "users");

    const batches = [];
    const unsubscribes = [];
  
    for(let i = 0; i < userIds.length; i += 30) {

        const chunk = userIds.slice(i, i + 30);
        const q = query(usersRef, where(documentId(), "in", chunk));
    
        const unsubscribe = onSnapshot(q, (querySnapshot) => {

            const users = querySnapshot.docs.map(doc => ({
                uid: doc.id,
                ...doc.data()
            }));
    
            batches[i / 30] = users;
    
            const allUsers = batches.flat();
            const uniqueUsers = Object.values(Object.fromEntries(
                allUsers.map(user => [user.id, user])
            ));

            setUsers(uniqueUsers);

        })
    
        unsubscribes.push(unsubscribe);

    }
  
    return () => {
        for(const unsub of unsubscribes) {
            if(typeof unsub === "function") unsub();
        }
    }

}

const useMembersList = (memberIds = []) => {
    const [members, setMembers] = useState([]);
  
    useEffect(() => {
        if(!memberIds.length) {
            setMembers([]);
            return;
        }
    
        const db = getFirestore();
        const unsubscribes = [];
        const batches = [];
    
        for(let i = 0; i < memberIds.length; i += 30) {

            const chunk = memberIds.slice(i, i + 30);
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where(documentId(), 'in', chunk));
    
            const unsub = onSnapshot(q, (snapshot) => {
                batches[i / 30] = snapshot.docs.map(doc => ({
                    uid: doc.id,
                    ...doc.data()
                }));
        
                const merged = batches.flat();
                const unique = Object.values(Object.fromEntries(
                    merged.map(u => [u.uid, u])
                ));

                setMembers(unique);
            });
    
            unsubscribes.push(unsub);
        }
    
        return () => unsubscribes.forEach(u => u());

    }, [memberIds]);
  
    return members;
}

export { 
    createNewUserObject, 
    getTotalUsers, 
    getTotalTasksCompleted, 
    getActiveUserCount,
    userCompleteTask,
    updateCurrentTask,
    updateStreak,
    updateStatus,
    getUsersByIds,
    useMembersList
}