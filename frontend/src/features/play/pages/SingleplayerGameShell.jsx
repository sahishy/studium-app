import { useEffect } from 'react'
import { useOutletContext, useParams } from 'react-router-dom'
import Topbar from '../../../shared/components/ui/Topbar'
import GameHandler from '../games/GameHandler'
import { setPlaySessionState } from '../services/playSessionService'

const SingleplayerGameShell = () => {
    const { modeId } = useParams()
    const { profile } = useOutletContext()

    useEffect(() => {
        if(!profile?.uid || !modeId) {
            return
        }

        void setPlaySessionState({
            userId: profile.uid,
            status: 'in_room',
            modeId,
            currentRoomId: null,
        })

        return () => {
            void setPlaySessionState({
                userId: profile.uid,
                status: 'idle',
                modeId: null,
                currentRoomId: null,
            })
        }
    }, [profile?.uid, modeId])

    return (
        <div className='relative flex flex-col h-full overflow-hidden'>
            <Topbar profile={profile} />

            <div className='w-full flex-1 min-h-0 px-24 pb-24 pt-2 flex items-center justify-center'>
                <div className='w-full max-w-5xl h-full min-h-[420px] max-h-[72vh]'>
                    <GameHandler modeId={modeId} roomId={null} userId={profile?.uid} />
                </div>
            </div>
        </div>
    )
}

export default SingleplayerGameShell