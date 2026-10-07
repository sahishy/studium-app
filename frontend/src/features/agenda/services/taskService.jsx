import { doc, setDoc, updateDoc, deleteDoc, collection, onSnapshot, query, getDoc, getDocs, writeBatch, where } from 'firebase/firestore'
import { updateUserPreference } from '../../auth/services/userService';
import { useEffect, useState } from 'react';
import { extractTaskTitleMetadata, normalizeTaskTitle } from '../utils/naturalLanguage';
import { LIST_GROUP_OPTIONS } from '../utils/taskListUtils';
import { VALID_BOARD_GROUPS, VALID_CALENDAR_SORTS, VALID_LIST_GROUPS } from '../utils/agendaPreferences';
import { db } from '../../../lib/firebase';

const createTask = async ({ title, status, listIndex, boardIndex, userId, taskId, parentTaskId, siblingIndex, type }) => {

    const collectionRef = collection(db, 'tasks')
    const now = new Date()

    const normalizedTitle = normalizeTaskTitle(title)
    const task = {
        title: normalizedTitle,
        circleId: extractTaskTitleMetadata(normalizedTitle).circleId || null,
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

const updateTask = async (taskId, taskData) => {

    const taskRef = doc(db, 'tasks', taskId)
    const taskSnap = await getDoc(taskRef)
    if (!taskSnap.exists()) {
        return
    }

    const normalizedTaskData = {
        ...taskData,
        ...(Object.hasOwn(taskData, 'title') ? { title: normalizeTaskTitle(taskData.title) } : {}),
        ...(Object.hasOwn(taskData, 'title') ? { circleId: extractTaskTitleMetadata(normalizeTaskTitle(taskData.title)).circleId || null } : {}),
    }

    await updateDoc(taskRef, { ...normalizedTaskData, updatedAt: new Date() })

}

const deleteTask = async (taskId) => {
    const taskRef = doc(db, 'tasks', taskId)
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

const updateAgendaPreferences = async (uid, preferences) => {
    const groupBy = preferences?.list?.groupBy
    if (!uid || !VALID_LIST_GROUPS.has(groupBy) || !['smart', 'table'].includes(preferences?.list?.layout) || !['keep', 'delete'].includes(preferences?.list?.completionBehavior) || !VALID_BOARD_GROUPS.has(preferences?.board?.groupBy) || !VALID_CALENDAR_SORTS.has(preferences?.calendar?.sortBy)) {
        throw new Error('Invalid agenda preferences')
    }
    const userRef = doc(db, 'users', uid)
    await updateDoc(userRef, {
        'preferences.agenda': preferences,
        'preferences.groupTasksBy': groupBy,
    })
}

const useUserTasks = (userId) => {

    const [userTasks, setUserTasks] = useState([]);
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        setIsReady(false);

        if (!userId) {
            setUserTasks([])
            setIsReady(true)
            return undefined
        }

        const tasksRef = collection(db, 'tasks');
        const q = query(tasksRef, where('userId', '==', userId));

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
    }, [userId]);

    return { tasks: userTasks, isReady };

}

const useCircleTasks = (circleIds = []) => {
    const [tasks, setTasks] = useState([])
    const idsKey = circleIds.join('|')
    useEffect(() => {
        if(!idsKey) { setTasks([]); return undefined }
        const ids = idsKey.split('|')
        const chunks = []
        for(let index = 0; index < ids.length; index += 30) chunks.push(ids.slice(index, index + 30))
        const byChunk = new Map()
        const unsubscribers = chunks.map((chunk, index) => onSnapshot(query(collection(db, 'tasks'), where('circleId', 'in', chunk)), (snapshot) => {
            byChunk.set(index, snapshot.docs.map((entry) => ({ uid: entry.id, ...entry.data(), title: normalizeTaskTitle(entry.data().title) })))
            setTasks([...new Map([...byChunk.values()].flat().map((task) => [task.uid, task])).values()])
        }))
        return () => unsubscribers.forEach((unsubscribe) => unsubscribe())
    }, [idsKey])
    return tasks
}

export {
    createTask,
    updateTask,
    deleteTask,
    deleteCircleTasks,
    updateTaskGroupingPreference,
    updateAgendaPreferences,
    useUserTasks,
    useCircleTasks,
}
