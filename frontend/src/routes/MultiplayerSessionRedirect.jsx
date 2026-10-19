import { Navigate, Outlet, useLocation, useOutletContext } from 'react-router-dom'
import { useMultiplayer } from '../features/multiplayer/contexts/MultiplayerContext'
import { getMatchRedirectPath } from '../features/multiplayer/utils/matchEntryState'

const MultiplayerSessionRedirect = () => {

    const { session, pendingMatch } = useMultiplayer()
    const location = useLocation()
    const parentContext = useOutletContext()

    const roomPath = getMatchRedirectPath({ session, pendingMatch }, location.pathname)
    if(roomPath) return <Navigate to={roomPath} replace/>

    return <Outlet context={parentContext}/>
}

export default MultiplayerSessionRedirect
