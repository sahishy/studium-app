import { Navigate } from 'react-router-dom'
import { useAuth } from '../features/auth/contexts/AuthContext'
import LoadingState from '../shared/components/ui/LoadingState'

const PrivateRoute = ( { children } ) => {
    const { user, loading } = useAuth()

    if(loading) {
        return <LoadingState fullPage label='Loading...' />
    }

    return user ? children : <Navigate to="/login" replace/>
}

export default PrivateRoute;