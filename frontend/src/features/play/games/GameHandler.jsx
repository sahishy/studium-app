import BlitzGame from './blitz/BlitzGame'
import SatClassicGame from './sat-classic/SatClassicGame'
import ErrorState from '../../../shared/components/ui/ErrorState'

const GameHandler = ({ modeId, roomId, userId }) => {

    if(modeId === 'blitz') {
        return <BlitzGame userId={userId} />
    }

    if(modeId === 'sat-classic') {
        return (
            <SatClassicGame
                roomId={roomId}
                userId={userId}
            />
        )
    }

    return (
        <ErrorState
            title='Unsupported game mode'
            description={`No game module found for mode: ${modeId || 'unknown'}`}
        />
    )
    
}

export default GameHandler
