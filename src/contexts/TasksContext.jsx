import React, { createContext, useContext, useMemo } from 'react';
import { useUserTasks, useCircleTasks } from '../utils/taskUtils';
import { useAuth } from './AuthContext';
import { useCircles } from './CirclesContext';

const TasksContext = createContext({ user: [], circle: [] });

const TasksProvider = ( { profile, children } ) => {

    const circles = useCircles();

    const circleIds = useMemo(() => circles.map(circle => circle.uid), [circles]);
    const user = useUserTasks(profile.uid);
    const circle = useCircleTasks(circleIds);
  
    return (
        <TasksContext.Provider value={{ user, circle }}>
            {children}
        </TasksContext.Provider>
    );
}

const useTasks = () => useContext(TasksContext);

export {
    TasksProvider,
    useTasks
}