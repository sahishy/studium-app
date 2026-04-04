import { doc, updateDoc, collection, getAggregateFromServer, getCountFromServer, getFirestore, onSnapshot, query, sum, where, increment, documentId, getDocs } from 'firebase/firestore'
import { useEffect, useState } from 'react';
import { getRandomAvatarColor } from '../utils/avatarUtils';
import { generateRandomDisplayName, isDisplayNameFormatValid } from '../utils/userUtils';

const isDisplayNameAvailable = async (displayName, excludeUid = null) => {
    if(!isDisplayNameFormatValid(displayName)) {
        return false;
    }

    const db = getFirestore();
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('profile.displayName', '==', displayName));
    const querySnapshot = await getDocs(q);

    if(querySnapshot.empty) {
        return true;
    }

    if(!excludeUid) {
        return false;
    }

    return querySnapshot.docs.every((docSnap) => docSnap.id === excludeUid)
}

const generateUniqueDisplayName = async (maxAttempts = 20) => {
    for(let i = 0; i < maxAttempts; i++) {
        const displayName = generateRandomDisplayName();
        const available = await isDisplayNameAvailable(displayName);

        if(available) {
            return displayName;
        }
    }

    throw new Error('Unable to generate an available display name.');
}

const createNewUserObject = async ({ firstName, lastName, email }) => {
    const displayName = await generateUniqueDisplayName();

    return {
        firstName: firstName,
        lastName: lastName,
        email: email,
        profile: {
            displayName,
            avatar: {
                color: getRandomAvatarColor(),
                face: 0,
            },
            profilePicture: {
                url: '',
                lastUpdated: new Date(),
            }
        },
        createdAt: new Date(),
        progress: {
            level: 1,
            xp: 0,
            streak: 0,
            tasksCompleted: 0,
        }
    }
}

const updateUserInfo = async (uid, userData) => {
    const db = getFirestore();
    const userRef = doc(db, 'users', uid)

    await updateDoc(userRef, userData)
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
        totalTasksCompleted: sum('progress.tasksCompleted')
    });

    return totalTasksCompletedSnapshot.data().totalTasksCompleted
}

const userCompleteTask = async (profile) => {
    const db = getFirestore();
    const userRef = doc(db, 'users', profile.uid)
    const currentTasksCompleted = profile?.progress?.tasksCompleted ?? profile?.tasksCompleted ?? 0

    await updateDoc(userRef, {
        'progress.tasksCompleted': currentTasksCompleted + 1
    })
}

const updateStatus = async (profile, status) => {
    const db = getFirestore();
    const userRef = doc(db, 'users', profile.uid);

    await updateDoc(userRef, {
        lastSeen: new Date(),
        status: status
    })
}

const updateStreak = async (profile, reset = false) => {
    const db = getFirestore();
    const docRef = doc(db, 'users', profile.uid);

    if(reset) {
        await updateDoc(docRef, { 'progress.streak': 0 });
    } else {
        await updateDoc(docRef, { 'progress.streak': increment(1) });
    }
}

const getUsersByIds = (userIds, setUsers) => {
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
                allUsers.map(user => [user.uid, user])
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
    isDisplayNameAvailable,
    generateUniqueDisplayName,
    updateUserInfo,
    getTotalUsers,
    getTotalTasksCompleted,
    getActiveUserCount,
    userCompleteTask,
    updateStreak,
    updateStatus,
    getUsersByIds,
    useMembersList
}