import { createContext, useContext } from 'react';
import { useUserCircles } from '../services/circleService';
import LoadingState from '../../../shared/components/ui/LoadingState';

const CirclesContext = createContext([]);
const ConfirmedContext = createContext(false);

const CirclesProvider = ( { profile, children } ) => {

    const { circles, loading, confirmed } = useUserCircles(profile?.uid);

    return (
        <ConfirmedContext.Provider value={confirmed}><CirclesContext.Provider value={circles}>
            {loading ? <LoadingState fullPage /> : children}
        </CirclesContext.Provider></ConfirmedContext.Provider>
    )

}

const useCirclesConfirmed = () => useContext(ConfirmedContext);

const useCircles = () => useContext(CirclesContext);

export {
    CirclesProvider,
    useCircles,
    useCirclesConfirmed
}
