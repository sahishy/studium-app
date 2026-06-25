import { Navigate, Outlet, useLocation, useOutletContext } from 'react-router-dom'
import { useMultiplayer } from '../features/play/contexts/MultiplayerContext'

const PlaySessionRedirect = () => {

    const { session } = useMultiplayer()
    const location = useLocation()
    const parentContext = useOutletContext()

    const currentRoomId = session?.currentRoomId
    const currentModeId = session?.modeId
    const inRoomState = session?.status === 'in_room'

    if(inRoomState && currentRoomId) {
        const roomPath = `/play/room/${currentRoomId}`

        if(location.pathname !== roomPath) {
            return <Navigate to={roomPath} replace/>
        }
    }

    if(inRoomState && !currentRoomId && currentModeId) {
        const gamePath = `/play/game/${currentModeId}`

        if(location.pathname !== gamePath) {
            return <Navigate to={gamePath} replace/>
        }
    }

    return <Outlet context={parentContext}/>
}

export default PlaySessionRedirect