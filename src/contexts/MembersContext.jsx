import React, { createContext, useContext, useMemo } from 'react';
import { useMembersList } from '../utils/userUtils';
import { useCircles } from './CirclesContext';

const MembersContext = createContext([]);

const MembersProvider = ( { children } ) => {

    const circles = useCircles();

    const memberIds = useMemo(
        () => circles.flatMap(circle => circle.userIds || []),
        [circles]
    );
    
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