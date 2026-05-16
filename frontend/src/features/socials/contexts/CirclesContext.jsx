import { createContext, useContext } from 'react';
import { useUserCircles } from '../services/circleService';

const CirclesContext = createContext([]);

const CirclesProvider = ( { profile, children } ) => {

    const { circles, loading } = useUserCircles(profile?.uid);

    return (
        <CirclesContext.Provider value={circles}>
            {!loading && children}
        </CirclesContext.Provider>
    )

}

const useCircles = () => useContext(CirclesContext);

export {
    CirclesProvider,
    useCircles
}