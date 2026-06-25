import { Navigate } from 'react-router-dom'

const CircleAgendaIndexRedirect = () => {

    const pages = ['list', 'calendar', 'board']

    let lastPage = localStorage.getItem('circleAgenda:lastTab')
    if (lastPage && !pages.includes(lastPage)) {
        lastPage = 'list'
    }

    const defaultTab = lastPage || 'list'

    return <Navigate to={defaultTab} replace />
}

export default CircleAgendaIndexRedirect
