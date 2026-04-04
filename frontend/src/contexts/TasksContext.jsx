import { createContext, useContext, useMemo } from 'react';
import { useUserTasks, useCircleTasks } from '../services/taskService';
import { useAuth } from './AuthContext';
import { useCircles } from './CirclesContext';

const TasksContext = createContext({ user: [], circle: [] });

const TasksProvider = ( { profile, children } ) => {

    const circles = useCircles();

    const circleIds = useMemo(() => circles.map(circle => circle.uid), [circles]);
    const userResult = useUserTasks(profile.uid);
    const circleResult = useCircleTasks(circleIds);

    const user = userResult.tasks;
    const circle = circleResult.tasks;
    const isReady = userResult.isReady && circleResult.isReady;
  
    return (
        <TasksContext.Provider value={{ user, circle, isReady }}>
            {children}
        </TasksContext.Provider>
    );
}

const useTasks = () => useContext(TasksContext);

export {
    TasksProvider,
    useTasks
}