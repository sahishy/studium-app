import { doc, setDoc, updateDoc, deleteDoc, getFirestore, collection, onSnapshot, where, query, getDoc, getDocs, writeBatch } from 'firebase/firestore'
import { updateCircleXP, updateUserXP } from './xpService';
import confetti from 'canvas-confetti';
import { updateCurrentTask, userCompleteTask } from './userService';
import { useEffect, useMemo, useState } from 'react';

const createTask = async ({ title, dueAt, status, listIndex, boardIndex, ownerType, ownerId, createdByUserId, taskId }) => {
    const db = getFirestore();
    const collectionRef = collection(db, 'tasks')
    const now = new Date()

    const task = {
        title: (title ? title : ''),
        dueAt: (dueAt ? dueAt : -1),
        timeEstimate: 0,
        status: (status ? status : 'Incomplete'),
        listIndex: (listIndex ?? -1),
        boardIndex: (boardIndex ?? -1),
        ownerType: (ownerType ? ownerType : 'user'),
        ownerId: (ownerId ? ownerId : null),
        createdByUserId: (createdByUserId ? createdByUserId : null),
        createdAt: now,
        updatedAt: now
    }

    const taskRef = taskId ? doc(db, 'tasks', taskId) : doc(collectionRef)
    await setDoc(taskRef, task)

    return taskRef
}

const updateTask = async (taskId, taskData, userCurrentTask) => {
    const db = getFirestore()
    const taskRef = doc(db, 'tasks', taskId)
    const taskSnap = await getDoc(taskRef)

    const existingTask = taskSnap.data()
    const resolvedOwnerType = existingTask.ownerType || (existingTask.circleId ? 'circle' : 'user')
    const resolvedOwnerId = existingTask.ownerId || existingTask.circleId || existingTask.userId || null

    if(resolvedOwnerType === 'user' && resolvedOwnerId) {
        let taskDataWithUpdatedStatusAndTitle = existingTask;
        taskDataWithUpdatedStatusAndTitle.status = taskData.status;
        taskDataWithUpdatedStatusAndTitle.title = taskData.title;

        if(taskData.status === 'In Progress') {
            updateCurrentTask(resolvedOwnerId, { ...taskDataWithUpdatedStatusAndTitle, uid: taskId })
        } else if(userCurrentTask && userCurrentTask.uid === taskId) {
            updateCurrentTask(resolvedOwnerId, null)
        }
    }

    if(taskData.status === 'Completed' && existingTask.status !== 'Completed') {
        completeTaskAnimation(resolvedOwnerType === 'circle');

        if(resolvedOwnerType === 'user' && resolvedOwnerId) {
            const userRef = doc(db, 'users', resolvedOwnerId)
            const userSnap = await getDoc(userRef);

            await updateUserXP(userSnap.data(), 10);
            await userCompleteTask(userSnap.data());
        } else if(resolvedOwnerType === 'circle' && resolvedOwnerId) {
            const circleRef = doc(db, 'circles', resolvedOwnerId)
            const circleSnap = await getDoc(circleRef);

            await updateCircleXP(circleSnap.data(), 10);
        }
    }

    await updateDoc(taskRef, { ...taskData, updatedAt: new Date() })
}

const deleteTask = async (taskId) => {
    const db = getFirestore();
    const taskRef = doc(db, 'tasks', taskId)

    deleteDoc(taskRef);
}

const completeTask = async (taskId) => {
    const db = getFirestore()

    const taskRef = doc(db, 'tasks', taskId)
    const taskSnap = await getDoc(taskRef);
    const taskData = taskSnap.data();

    const resolvedOwnerType = taskData.ownerType || (taskData.circleId ? 'circle' : 'user')
    const resolvedOwnerId = taskData.ownerId || taskData.circleId || taskData.userId || null

    completeTaskAnimation(resolvedOwnerType === 'circle');

    if(resolvedOwnerType === 'user' && resolvedOwnerId) {
        const userRef = doc(db, 'users', resolvedOwnerId)
        const userSnap = await getDoc(userRef);

        await updateUserXP(userSnap.data(), 10);
        await userCompleteTask(userSnap.data());
    } else if(resolvedOwnerType === 'circle' && resolvedOwnerId) {
        const circleRef = doc(db, 'circles', resolvedOwnerId)
        const circleSnap = await getDoc(circleRef);

        await updateCircleXP(circleSnap.data(), 10);
    }

    await deleteDoc(taskRef);
}

const deleteCircleTasks = async (circleId) => {
    const db = getFirestore()
    const tasksRef = collection(db, 'tasks')
    const q = query(tasksRef, where('ownerType', '==', 'circle'), where('ownerId', '==', circleId))

    const snapshot = await getDocs(q)
    if(snapshot.empty) {
        console.log('No tasks to delete for circle', circleId)
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

const completeTaskAnimation = (isCircle) => {
    confetti({
        origin: { y: -0.2 },
        angle: 270,
        spread: 180,
        startVelocity: 30,
        colors: (isCircle ? ['#38bdf8'] : ['#facc15'])
    });
}

const useUserTasks = (userId) => {
    const [userTasks, setUserTasks] = useState([]);

    useEffect(() => {
        if(!userId) {
            setUserTasks([]);
            return;
        }

        const db = getFirestore();
        const tasksRef = collection(db, 'tasks');
        const q = query(tasksRef, where('ownerType', '==', 'user'), where('ownerId', '==', userId));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                uid: doc.id,
                ...doc.data(),
                dueAt: doc.data().dueAt ?? doc.data().dueDate ?? -1,
                ownerType: doc.data().ownerType ?? (doc.data().circleId ? 'circle' : 'user'),
                ownerId: doc.data().ownerId ?? doc.data().userId ?? doc.data().circleId ?? null,
            }));
            setUserTasks(data);
        });

        return () => unsubscribe();
    }, [userId]);

    return userTasks;
}

const useCircleTasks = (circleIds = []) => {
    const [circleTasks, setCircleTasks] = useState([]);
    const CIRCLE_BATCH_SIZE = 10;

    const validIds = useMemo(
        () => circleIds.filter(id => typeof id === 'string'),
        [circleIds.join(',')]
    );

    useEffect(() => {
        if(!validIds.length) {
            setCircleTasks([]);
            return;
        }

        const db = getFirestore();
        const tasksRef = collection(db, 'tasks');

        if(validIds.length <= CIRCLE_BATCH_SIZE) {
            const q = query(tasksRef, where('ownerType', '==', 'circle'), where('ownerId', 'in', validIds));
            const unsub = onSnapshot(q, snapshot => {
                const data = snapshot.docs.map(doc => ({
                    uid: doc.id,
                    ...doc.data(),
                    dueAt: doc.data().dueAt ?? doc.data().dueDate ?? -1,
                    ownerType: doc.data().ownerType ?? (doc.data().circleId ? 'circle' : 'user'),
                    ownerId: doc.data().ownerId ?? doc.data().userId ?? doc.data().circleId ?? null,
                }));
                setCircleTasks(data);
            });

            return () => unsub();
        }

        const unsubscribes = [];
        const batches = [];

        for(let i = 0; i < validIds.length; i += CIRCLE_BATCH_SIZE) {
            const chunk = validIds.slice(i, i + CIRCLE_BATCH_SIZE);
            const q = query(tasksRef, where('ownerType', '==', 'circle'), where('ownerId', 'in', chunk));

            const unsub = onSnapshot(q, snapshot => {
                batches[i / CIRCLE_BATCH_SIZE] = snapshot.docs.map(doc => ({
                    uid: doc.id,
                    ...doc.data(),
                    dueAt: doc.data().dueAt ?? doc.data().dueDate ?? -1,
                    ownerType: doc.data().ownerType ?? (doc.data().circleId ? 'circle' : 'user'),
                    ownerId: doc.data().ownerId ?? doc.data().userId ?? doc.data().circleId ?? null,
                }));

                const merged = batches.flat();

                setCircleTasks(prev => {
                    if(prev.length === merged.length && prev.every((task, index) => task.uid === merged[index].uid)) {
                        return prev;
                    }

                    return merged;
                })
            })
            unsubscribes.push(unsub);
        }

        return () => unsubscribes.forEach(unsubscribe => unsubscribe())
    }, [validIds])

    return circleTasks
}

export {
    createTask,
    updateTask,
    deleteTask,
    deleteCircleTasks,
    completeTask,
    useUserTasks,
    useCircleTasks
}