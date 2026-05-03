import { doc, setDoc, updateDoc, deleteDoc, collection, onSnapshot, where, query, getDoc, getDocs, writeBatch } from 'firebase/firestore'
import { updateCircleXP, updateUserXP } from '../../profile/services/xpService';
import confetti from 'canvas-confetti';
import { updateUserPreference, userCompleteTask } from '../../auth/services/userService';
import { useEffect, useMemo, useState } from 'react';
import { normalizeTaskTitle } from '../utils/naturalLanguage';
import { LIST_GROUP_OPTIONS } from '../utils/taskListUtils';
import { db } from '../../../lib/firebase';

const createTask = async ({ title, dueAt, status, listIndex, boardIndex, ownerType, ownerId, taskId, parentTaskId, siblingIndex, type }) => {

    const collectionRef = collection(db, 'tasks')
    const now = new Date()

    const normalizedTitle = normalizeTaskTitle(title)

    const task = {
        title: normalizedTitle,
        dueAt: (dueAt ? dueAt : -1),
        type: (type || 'assignment'),
        status: (status ? status : 'Incomplete'),
        listIndex: (listIndex ?? -1),
        parentTaskId: (parentTaskId ?? null),
        siblingIndex: (siblingIndex ?? 0),
        boardIndex: (boardIndex ?? -1),
        ownerType: (ownerType ? ownerType : 'user'),
        ownerId: (ownerId ? ownerId : null),
        createdAt: now,
        updatedAt: now
    }

    const taskRef = taskId ? doc(db, 'tasks', taskId) : doc(collectionRef)
    await setDoc(taskRef, task)

    return taskRef

}

const updateTask = async (taskId, taskData) => {

    const taskRef = doc(db, 'tasks', taskId)
    const taskSnap = await getDoc(taskRef)

    const existingTask = taskSnap.data()
    const resolvedOwnerType = existingTask.ownerType || (existingTask.circleId ? 'circle' : 'user')
    const resolvedOwnerId = existingTask.ownerId || existingTask.circleId || existingTask.userId || null

    const normalizedTaskData = {
        ...taskData,
        ...(Object.hasOwn(taskData, 'title') ? { title: normalizeTaskTitle(taskData.title) } : {}),
    }

    if(normalizedTaskData.status === 'Completed' && existingTask.status !== 'Completed') {
        completeTaskAnimation(resolvedOwnerType === 'circle');

        if(resolvedOwnerType === 'user' && resolvedOwnerId) {
            const userRef = doc(db, 'users', resolvedOwnerId)
            const userSnap = await getDoc(userRef);
            const userProfile = { uid: resolvedOwnerId, ...userSnap.data() }

            await updateUserXP(userProfile, 10);
            await userCompleteTask(userProfile);
        } else if(resolvedOwnerType === 'circle' && resolvedOwnerId) {
            const circleRef = doc(db, 'circles', resolvedOwnerId)
            const circleSnap = await getDoc(circleRef);

            await updateCircleXP(circleSnap.data(), 10);
        }
    }

    await updateDoc(taskRef, { ...normalizedTaskData, updatedAt: new Date() })

}

const deleteTask = async (taskId) => {
    const taskRef = doc(db, 'tasks', taskId)
    await deleteDoc(taskRef);
}

const completeTask = async (taskId) => {

    const taskRef = doc(db, 'tasks', taskId)
    const taskSnap = await getDoc(taskRef);
    const taskData = taskSnap.data();

    const resolvedOwnerType = taskData.ownerType || (taskData.circleId ? 'circle' : 'user')
    const resolvedOwnerId = taskData.ownerId || taskData.circleId || taskData.userId || null

    completeTaskAnimation(resolvedOwnerType === 'circle');

    if(resolvedOwnerType === 'user' && resolvedOwnerId) {
        const userRef = doc(db, 'users', resolvedOwnerId)
        const userSnap = await getDoc(userRef);
        const userProfile = { uid: resolvedOwnerId, ...userSnap.data() }

        await updateUserXP(userProfile, 10);
        await userCompleteTask(userProfile);
    } else if(resolvedOwnerType === 'circle' && resolvedOwnerId) {
        const circleRef = doc(db, 'circles', resolvedOwnerId)
        const circleSnap = await getDoc(circleRef);

        await updateCircleXP(circleSnap.data(), 10);
    }

    await deleteDoc(taskRef);

}

const deleteCircleTasks = async (circleId) => {

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

const updateTaskGroupingPreference = async (uid, groupTasksBy) => {
    const validGroupIds = new Set(LIST_GROUP_OPTIONS.map((option) => option.id))
    if(!validGroupIds.has(groupTasksBy)) {
        throw new Error(`Invalid groupTasksBy preference: ${groupTasksBy}`)
    }

    await updateUserPreference(uid, 'groupTasksBy', groupTasksBy)
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
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        setIsReady(false);

        if(!userId) {
            setUserTasks([]);
            setIsReady(true);
            return;
        }

        const tasksRef = collection(db, 'tasks');
        const q = query(tasksRef, where('ownerType', '==', 'user'), where('ownerId', '==', userId));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                uid: doc.id,
                ...doc.data(),
                title: normalizeTaskTitle(doc.data().title),
                dueAt: doc.data().dueAt ?? doc.data().dueDate ?? -1,
                parentTaskId: doc.data().parentTaskId ?? null,
                siblingIndex: doc.data().siblingIndex ?? 0,
                ownerType: doc.data().ownerType ?? (doc.data().circleId ? 'circle' : 'user'),
                ownerId: doc.data().ownerId ?? doc.data().userId ?? doc.data().circleId ?? null,
            }));
            setUserTasks(data);
            setIsReady(true);
        });

        return () => unsubscribe();
    }, [userId]);

    return { tasks: userTasks, isReady };

}

const useCircleTasks = (circleIds = []) => {

    const [circleTasks, setCircleTasks] = useState([]);
    const [isReady, setIsReady] = useState(false);
    const CIRCLE_BATCH_SIZE = 10;

    const validIds = useMemo(
        () => circleIds.filter(id => typeof id === 'string'),
        [circleIds.join(',')]
    );

    useEffect(() => {
        setIsReady(false);

        if(!validIds.length) {
            setCircleTasks([]);
            setIsReady(true);
            return;
        }

        const tasksRef = collection(db, 'tasks');

        if(validIds.length <= CIRCLE_BATCH_SIZE) {
            const q = query(tasksRef, where('ownerType', '==', 'circle'), where('ownerId', 'in', validIds));
            const unsub = onSnapshot(q, snapshot => {
                const data = snapshot.docs.map(doc => ({
                    uid: doc.id,
                    ...doc.data(),
                    title: normalizeTaskTitle(doc.data().title),
                    dueAt: doc.data().dueAt ?? doc.data().dueDate ?? -1,
                    parentTaskId: doc.data().parentTaskId ?? null,
                    siblingIndex: doc.data().siblingIndex ?? 0,
                    ownerType: doc.data().ownerType ?? (doc.data().circleId ? 'circle' : 'user'),
                    ownerId: doc.data().ownerId ?? doc.data().userId ?? doc.data().circleId ?? null,
                }));
                setCircleTasks(data);
                setIsReady(true);
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
                    title: normalizeTaskTitle(doc.data().title),
                    dueAt: doc.data().dueAt ?? doc.data().dueDate ?? -1,
                    parentTaskId: doc.data().parentTaskId ?? null,
                    siblingIndex: doc.data().siblingIndex ?? 0,
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

                setIsReady(true);
            })
            unsubscribes.push(unsub);
        }

        return () => unsubscribes.forEach(unsubscribe => unsubscribe())
    }, [validIds])

    return { tasks: circleTasks, isReady }

}

export {
    createTask,
    updateTask,
    deleteTask,
    deleteCircleTasks,
    updateTaskGroupingPreference,
    completeTask,
    useUserTasks,
    useCircleTasks
}