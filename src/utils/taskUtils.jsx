import { doc, updateDoc, deleteDoc, getFirestore, collection, addDoc, onSnapshot, where, query, setDoc, getDoc, documentId, getDocs, writeBatch } from 'firebase/firestore'
import { updateCircleXP, updateUserXP } from './xpUtils';
import confetti from 'https://cdn.skypack.dev/canvas-confetti';
import { updateCurrentTask, userCompleteTask } from './userUtils';
import { useEffect, useMemo, useState } from 'react';

const createTask = async ( { userId, circleId, dueDate } ) => {

    const db = getFirestore();
    const collectionRef = collection(db, 'tasks')

    const task = {
        title: '',
        subject: '',
        dueDate: dueDate,
        timeEstimate: 0,
        status: 'Incomplete',
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

    const lengths = { day: 86400000, week: 604800000, year: 31536000000 }
    const today = Date.now();
    const date = seconds * 1000;

    if(new Date(today).toLocaleDateString() === new Date(date).toLocaleDateString()) {
        return 'Today';
    } else if(new Date(today + lengths.day).toLocaleDateString() === new Date(date).toLocaleDateString()) {
        return 'Tomorrow';
    } else if(new Date(today - lengths.day).toLocaleDateString() === new Date(date).toLocaleDateString()) {
        return 'Yesterday';
    }

    const difference = (date - today);

    if(difference < 0) {
        return new Date(date).toLocaleDateString();
    } else if(difference < lengths.week) {
        return new Date(date).toLocaleDateString('default', { weekday: 'long' });
    } else if(difference < lengths.year) {

        let nth = 'th'
        switch(new Date(date).getDate() % 10) {
            case 1:
                nth = 'st';
                break;
            case 2:
                nth = 'nd';
                break;
            case 3:
                nth = 'rd';
                break;
        }
        return new Date(date).toLocaleDateString('default', { day: 'numeric', month: 'long' } ) + nth;


    } else {
        return new Date(date).toLocaleDateString();
    }

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