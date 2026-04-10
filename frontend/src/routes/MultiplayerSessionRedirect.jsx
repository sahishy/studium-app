import { Navigate, Outlet, useLocation, useOutletContext } from 'react-router-dom'
import { useMultiplayer } from '../features/multiplayer/contexts/MultiplayerContext'

const MultiplayerSessionRedirect = () => {

    const { session } = useMultiplayer()
    const location = useLocation()
    const parentContext = useOutletContext()

    const currentRoomId = session?.currentRoomId
    const inRoomState = session?.status === 'in_room' && Boolean(currentRoomId)

    if(inRoomState) {
        const roomPath = `/ranked/room/${currentRoomId}`

        if(location.pathname !== roomPath) {
            return <Navigate to={roomPath} replace/>
        }
    }

    return <Outlet context={parentContext}/>
}

export default MultiplayerSessionRedirect
