import { useEffect, useState } from 'react'
import AvatarPicture from '../../../shared/components/avatar/AvatarPicture'
import DisplayName from './DisplayName'
import Title from './Title'
import PlayerLevel from './PlayerLevel'
import { getUserStatsByUserId } from '../services/statsService'
import { getCombinedRankedElo } from '../../multiplayer/utils/multiplayerUtils'

const AuthorIdentity = ({ author, children, compact = false }) => {
    const [statsRecord, setStatsRecord] = useState(null)
    const userStats = statsRecord?.uid === author?.uid ? statsRecord?.value : null

    useEffect(() => {
        let cancelled = false
        if(!author?.uid) return
        getUserStatsByUserId(author.uid)
            .then(value => { if(!cancelled) setStatsRecord({ uid: author.uid, value }) })
            .catch(() => { if(!cancelled) setStatsRecord({ uid: author.uid, value: null }) })
        return () => { cancelled = true }
    }, [author?.uid])

    return (
        <div className={`flex min-w-0 items-center ${compact ? 'gap-2' : 'gap-3'}`}>
            <AvatarPicture profile={author} className={`${compact ? 'w-12 h-12' : 'w-18 h-18'} shrink-0`} />
            <div className='flex min-w-0 flex-col'>
                <DisplayName targetProfile={author} userStats={userStats} className={`font-semibold text-neutral0 flex-wrap break-words ${compact ? 'text-sm' : ''}`} />
                <Title titleId={author?.profile?.title} size={compact ? 'xs' : 'sm'} />
                <div className={`mt-1 flex flex-wrap items-center font-semibold text-neutral1 ${compact ? 'gap-2 text-xs' : 'gap-3 text-sm'}`}>
                    <p>{getCombinedRankedElo(userStats)} <span className='text-[0.625rem] font-medium'>SAT</span></p>
                    <PlayerLevel level={author?.progress?.level} className={compact ? 'text-[10px]! [&_svg]:text-xs [&_svg]:mr-0' : ''} />
                </div>
                {children}
            </div>
        </div>
    )
}

export default AuthorIdentity
