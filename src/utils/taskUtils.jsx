import { doc, updateDoc, deleteDoc, getFirestore, collection, addDoc, onSnapshot, where, query, setDoc, getDoc, documentId, getDocs, writeBatch } from 'firebase/firestore'
import { updateCircleXP, updateUserXP } from './xpUtils';
import confetti from 'https://cdn.skypack.dev/canvas-confetti';
import { updateCurrentTask, userCompleteTask } from './userUtils';
import { useEffect, useMemo, useState } from 'react';

const createTask = async ( { title, subject, dueDate, status, listIndex, boardIndex, userId, circleId } ) => {

    const db = getFirestore();
    const collectionRef = collection(db, 'tasks')

    const task = {
        title: (title ? title : ''),
        subject: (subject ? subject : ''),
        dueDate: (dueDate ? dueDate : -1),
        timeEstimate: 0,
        status: (status ? status : 'Incomplete'),
        listIndex: (listIndex ? listIndex : -1),
        boardIndex: (boardIndex ? boardIndex : -1),
        userId: (userId ? userId : null),
        circleId: (circleId ? circleId : null),
        createdAt: new Date()
    }

    const taskRef = await addDoc(collectionRef, task)

    await updateDoc(taskRef, {
        uid: taskRef.id
    })

    return taskRef

}

const updateTask = async (taskId, taskData, userCurrentTask) => {

    const db = getFirestore()
    const taskRef = doc(db, 'tasks', taskId)
    const taskSnap = await getDoc(taskRef)

    if(taskSnap.data().userId) {

        //update current task user is doing
        let taskDataWithUpdatedStatusAndTitle = taskSnap.data();
        taskDataWithUpdatedStatusAndTitle.status = taskData.status;
        taskDataWithUpdatedStatusAndTitle.title = taskData.title;
    
        if(taskData.status === 'In Progress') {
            updateCurrentTask(taskSnap.data().userId, { ...taskDataWithUpdatedStatusAndTitle, uid: taskId })
        } else if(userCurrentTask && userCurrentTask.uid === taskId) {
            updateCurrentTask(taskSnap.data().userId, null)
        }

    }
    if(taskData.status === 'Completed') {
        completeTask(taskId);
    }

    await updateDoc(taskRef, taskData)

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
    
    completeTaskAnimation(taskData.circleId !== null);

    if(taskData.userId) {

        const userRef = doc(db, 'users', taskData.userId)
        const userSnap = await getDoc(userRef);
    
        await updateUserXP(userSnap.data(), 10);
        await userCompleteTask(userSnap.data());

    } else if(taskData.circleId) {

        const circleRef = doc(db, 'circles', taskData.circleId)
        const circleSnap = await getDoc(circleRef);
    
        await updateCircleXP(circleSnap.data(), 10);

    }

    await deleteDoc(taskRef);

}

const deleteCircleTasks = async (circleId) => {

    const db = getFirestore()
    const tasksRef = collection(db, 'tasks')
    const q = query(tasksRef, where('circleId', '==', circleId))
  
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

const formatDate = (seconds) => {
    
    const MS = {
        day: 86400000,
        week: 604800000,
        year: 31536000000,
    };
    const now = Date.now();
    const dateMs = seconds * 1000;
    const today = new Date(now);
    const target = new Date(dateMs);

    const isSameDay = (a, b) => a.toDateString() === b.toDateString();

    if (isSameDay(today, target)) return 'Today';
    if (isSameDay(new Date(now + MS.day), target)) return 'Tomorrow';
    if (isSameDay(new Date(now - MS.day), target)) return 'Yesterday';

    const diff = dateMs - now;

    if (diff < 0) {
        // past
        return target.toLocaleDateString();
    }

    // within next 7 days (excluding today)
    if (diff < MS.week) {
        return target.toLocaleDateString('default', { weekday: 'long' });
    }

    // between 7 and 14 days out: "Next Tuesday" etc.
    if (diff < 2 * MS.week) {
        const weekday = target.toLocaleDateString('default', { weekday: 'long' });
        return `Next ${weekday}`;
    }

    // within this year, show "Month Day<st/nd/rd/th>"
    if (diff < MS.year) {
        const day = target.getDate();
        let suffix = 'th';
        if (!(day % 100 >= 10 && day % 100 <= 19)) {
            if (day % 10 === 1) suffix = 'st';
            else if (day % 10 === 2) suffix = 'nd';
            else if (day % 10 === 3) suffix = 'rd';
        }
        const monthDay = target.toLocaleDateString('default', { day: 'numeric', month: 'long' });
        return `${monthDay}${suffix}`;
    }

    // fallback
    return target.toLocaleDateString();
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
        const q = query(tasksRef, where('userId', '==', userId));
    
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                uid: doc.id,
                ...doc.data()
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

            const q = query(tasksRef, where('circleId', 'in', validIds));
            const unsub = onSnapshot(q, snapshot => {
            const data = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
                setCircleTasks(data);
            });

            return () => unsub();
        }
  
        const unsubscribes = [];
        const batches = [];
    
        for(let i = 0; i < validIds.length; i += CIRCLE_BATCH_SIZE) {
            const chunk = validIds.slice(i, i + CIRCLE_BATCH_SIZE);
            const q = query(tasksRef, where('circleId', 'in', chunk));

            const unsub = onSnapshot(q, snapshot => {

                batches[i / CIRCLE_BATCH_SIZE] = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));

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
    formatDate,
    useUserTasks,
    useCircleTasks
}