import { FaArrowRight } from 'react-icons/fa6'
import AvatarPicture from '../../../shared/components/avatar/AvatarPicture'
import { useNavigate } from 'react-router-dom'

const FriendsListItem = ({ friend }) => {

    const navigate = useNavigate();

    if(!friend) {
        return null
    }

    return (
        <div className='flex flex-col items-center gap-2 max-w-24'>

            <button onClick={() => navigate(`/profile/${encodeURIComponent(friend?.profile?.displayName ?? '')}`)}>
                <AvatarPicture profile={friend} className='relative w-24 h-24 group/avatar cursor-pointer'>

                    <div className='absolute bottom-0.5 right-0.5 w-6 h-6 border-4 border-neutral6 rounded-full
                        bg-sky-400 opacity-100 group-hover/avatar:opacity-0 transition'/>
                    
                    <div className={`absolute -bottom-0.5 -right-0.5 bg-neutral3/60 backdrop-blur-xs rounded-full p-2
                                opacity-0 group-hover/avatar:opacity-100 transition
                            `}>
                        <FaArrowRight className='text-sm group-hover/avatar:-rotate-45 transition' />
                    </div>

                </AvatarPicture>
            </button>

            <p className='text-xs text-neutral0 text-center truncate w-full'>
                {friend?.profile?.displayName ?? 'Unknown'}
            </p>

        </div>
    )

}

export default FriendsListItem
