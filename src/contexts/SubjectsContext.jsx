import React, { createContext, useContext, useMemo } from 'react';
import { useUserSubjects, useCircleSubjects } from '../utils/subjectUtils';
import { useAuth } from './AuthContext';
import { useCircles } from './CirclesContext';

const SubjectsContext = createContext({ user: [], circle: [] });

const SubjectsProvider = ( { profile, children } ) => {

    const circles = useCircles();
    const user = useUserSubjects(profile.uid);
    const circleIds = useMemo(() => circles.map(circle => circle.uid), [circles]);
    const circle = useCircleSubjects(circleIds);

    return (
        <SubjectsContext.Provider value={{ user, circle }}>
            {children}
        </SubjectsContext.Provider>
    );

}

const useSubjects = () => useContext(SubjectsContext);

export {
    SubjectsProvider,
    useSubjects
}