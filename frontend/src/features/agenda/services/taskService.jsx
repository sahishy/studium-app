import { doc, setDoc, updateDoc, deleteDoc, collection, onSnapshot, query, getDoc, getDocs, writeBatch } from 'firebase/firestore'
import { updateCircleXP, updateUserXP } from '../../profile/services/xpService';
import confetti from 'canvas-confetti';
import { updateUserPreference, userCompleteTask } from '../../auth/services/userService';
import { useEffect, useState } from 'react';
import { extractTaskTitleMetadata, normalizeTaskTitle } from '../utils/naturalLanguage';
import { LIST_GROUP_OPTIONS } from '../utils/taskListUtils';
import { calculateTaskCompletionXp } from '../utils/taskUtils';
import { db } from '../../../lib/firebase';

const createTask = async ({ title, status, listIndex, boardIndex, userId, taskId, parentTaskId, siblingIndex, type }) => {

    const collectionRef = collection(db, 'tasks')
    const now = new Date()

    const normalizedTitle = normalizeTaskTitle(title)
    const task = {
        title: normalizedTitle,
        type: (type || 'assignment'),
        status: (status ? status : 'Incomplete'),
        listIndex: (listIndex ?? -1),
        parentTaskId: (parentTaskId ?? null),
        siblingIndex: (siblingIndex ?? 0),
        boardIndex: (boardIndex ?? -1),
        userId: (userId || null),
        alreadyCompleted: false,
        createdAt: now,
        updatedAt: now
    }

    const taskRef = taskId ? doc(db, 'tasks', taskId) : doc(collectionRef)
    await setDoc(taskRef, task)

    return taskRef

}

const applyTaskCompletionRewards = async (taskData) => {

    const metadata = extractTaskTitleMetadata(taskData.title)
    const resolvedOwnerType = metadata.circleId ? 'circle' : 'user'
    const resolvedOwnerId = metadata.circleId || taskData.userId || null
    const xpReward = calculateTaskCompletionXp(taskData.createdAt, new Date())

    if (xpReward > 0) {
        completeTaskAnimation(resolvedOwnerType === 'circle')
    }

    if (resolvedOwnerType === 'user' && resolvedOwnerId) {
        const userRef = doc(db, 'users', resolvedOwnerId)
        const userSnap = await getDoc(userRef)
        const userProfile = { uid: resolvedOwnerId, ...userSnap.data() }

        await updateUserXP(userProfile, xpReward)
        await userCompleteTask(userProfile)
        return
    }

    if (resolvedOwnerType === 'circle' && resolvedOwnerId) {
        const circleRef = doc(db, 'circles', resolvedOwnerId)
        const circleSnap = await getDoc(circleRef)

        await updateCircleXP(circleSnap.data(), xpReward)
    }

}

const triggerTaskCompletionEffects = async (taskId) => {

    const taskRef = doc(db, 'tasks', taskId)
    const taskSnap = await getDoc(taskRef)
    if (!taskSnap.exists()) {
        return
    }

    const taskData = taskSnap.data()
    const alreadyCompleted = Boolean(taskData.alreadyCompleted)
    if (alreadyCompleted) {
        return
    }

    await applyTaskCompletionRewards(taskData)

    await updateDoc(taskRef, { alreadyCompleted: true, updatedAt: new Date() })

}

const updateTask = async (taskId, taskData) => {

    const taskRef = doc(db, 'tasks', taskId)
    const taskSnap = await getDoc(taskRef)
    if (!taskSnap.exists()) {
        return
    }

    const existingTask = taskSnap.data()
    const normalizedTaskData = {
        ...taskData,
        ...(Object.hasOwn(taskData, 'title') ? { title: normalizeTaskTitle(taskData.title) } : {}),
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

    await applyTaskCompletionRewards(taskData)

    await deleteDoc(taskRef);

}

const deleteCircleTasks = async (circleId) => {

    const tasksRef = collection(db, 'tasks')
    const q = query(tasksRef)

    const snapshot = await getDocs(q)
    const circleTaskDocs = snapshot.docs.filter((docSnap) => extractTaskTitleMetadata(docSnap.data().title).circleId === circleId)
    if (!circleTaskDocs.length) {
        console.log('No tasks to delete for circle', circleId)
        return
    }

    const batches = []
    let batch = writeBatch(db)
    let opCount = 0

    circleTaskDocs.forEach(docSnap => {
        batch.delete(docSnap.ref)
        opCount++

        if (opCount === 500) {
            batches.push(batch.commit())
            batch = writeBatch(db)
            opCount = 0
        }
    })

    if (opCount > 0) {
        batches.push(batch.commit())
    }

    await Promise.all(batches)

}

const updateTaskGroupingPreference = async (uid, groupTasksBy) => {
    const validGroupIds = new Set(LIST_GROUP_OPTIONS.map((option) => option.id))
    if (!validGroupIds.has(groupTasksBy)) {
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

const useUserTasks = () => {

    const [userTasks, setUserTasks] = useState([]);
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        setIsReady(false);

        const tasksRef = collection(db, 'tasks');
        const q = query(tasksRef);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                uid: doc.id,
                ...doc.data(),
                title: normalizeTaskTitle(doc.data().title),
                parentTaskId: doc.data().parentTaskId ?? null,
                siblingIndex: doc.data().siblingIndex ?? 0,
                userId: doc.data().userId ?? null,
                alreadyCompleted: doc.data().alreadyCompleted ?? false,
            }));
            setUserTasks(data);
            setIsReady(true);
        });

        return () => unsubscribe();
    }, []);

    return { tasks: userTasks, isReady };

}

export {
    createTask,
    triggerTaskCompletionEffects,
    updateTask,
    deleteTask,
    deleteCircleTasks,
    updateTaskGroupingPreference,
    completeTask,
    useUserTasks
}