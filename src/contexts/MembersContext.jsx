import React, { createContext, useContext, useMemo } from 'react';
import { useMembersList } from '../services/userService';
import { useCircles } from './CirclesContext';
import { useCircleMemberIds } from '../services/circleService';

const MembersContext = createContext([]);

const MembersProvider = ( { children } ) => {

    const circles = useCircles();
    const circleIds = useMemo(() => circles.map(circle => circle.uid), [circles]);

    const memberIds = useCircleMemberIds(circleIds);
    
    const members = useMembersList(memberIds);

    return (
        <MembersContext.Provider value={members}>
            {children}
        </MembersContext.Provider>
    );

}

const useMembers = () => useContext(MembersContext);

export {
    MembersProvider,
    useMembers
}