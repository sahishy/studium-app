import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import LoadingState from '../components/main/LoadingState'

const PrivateRoute = ( { children } ) => {
    const { user, loading } = useAuth()

    if(loading) {
        return <LoadingState fullPage label='Loading...' />
    }

    return user ? children : <Navigate to="/login" replace/>
}

export default PrivateRoute;