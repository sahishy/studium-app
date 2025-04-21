import { Navigate } from 'react-router-dom';

const AgendaIndexRedirect = () => {

    const last = localStorage.getItem('agenda:lastTab');

    const defaultTab = last ? last : 'overview'

    return <Navigate to={defaultTab} replace/>

}

export default AgendaIndexRedirect