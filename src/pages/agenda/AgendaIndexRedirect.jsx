import { Navigate } from 'react-router-dom';

const AgendaIndexRedirect = () => {

    const pages = ['list', 'calendar', 'board']

    const lastPage = localStorage.getItem('agenda:lastTab');
    if(lastPage && !pages.includes(lastPage)) {
        lastPage = 'list';
    }

    const defaultTab = lastPage ? lastPage : 'list'

    return <Navigate to={defaultTab} replace/>

}

export default AgendaIndexRedirect