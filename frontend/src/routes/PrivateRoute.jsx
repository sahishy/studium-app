import { Navigate } from 'react-router-dom'
import { useAuth } from '../features/auth/contexts/AuthContext'
import LoadingState from '../shared/components/ui/LoadingState'

const PrivateRoute = ( { children } ) => {

    const { user, loading } = useAuth()

    if(loading) {
        return <LoadingState fullPage/>
    }

    return user ? children : <Navigate to="/" replace/>

}

export default PrivateRoute;