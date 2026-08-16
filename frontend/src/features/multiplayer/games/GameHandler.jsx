import SatClassicGame from './sat-classic/SatClassicGame'
import ErrorState from '../../../shared/components/ui/ErrorState'
import BlitzGame from './blitz/BlitzGame'
import TimberGame from './timber/TimberGame'
import PunctureGame from './puncture/PunctureGame'
import FlutterGame from './flutter/FlutterGame'

const GameHandler = ({ modeId, roomId, userId }) => {

    if(modeId === 'sat-classic') {
        return (
            <SatClassicGame
                roomId={roomId}
                userId={userId}
            />
        )
    }

    if(modeId === 'blitz') {
        return <BlitzGame roomId={roomId} userId={userId} />
    }

    if(modeId === 'sat-timber') {
        return <TimberGame roomId={roomId} userId={userId} />
    }

    if(modeId === 'sat-puncture') {
        return <PunctureGame roomId={roomId} userId={userId} />
    }

    if(modeId === 'sat-flutter') {
        return <FlutterGame roomId={roomId} userId={userId} />
    }

    return (
        <ErrorState
            title='Unsupported game mode'
            description={`No game module found for mode: ${modeId || 'unknown'}`}
        />
    )
    
}

export default GameHandler
