import Card from '../../../shared/components/ui/Card'
import AvatarPicture from '../../../shared/components/avatar/AvatarPicture'
import { FaCircle } from 'react-icons/fa6'

const FriendCard = ({ friend }) => {

    if(!friend) {
        return null
    }

    return (
        <Card className='gap-2' hoverable>
            <div className='flex items-center gap-3 min-w-0'>

                <AvatarPicture profile={friend} className='w-16 h-16' />

                <div className='flex flex-col'>
                    <h2 className='text-sm font-semibold text-neutral0 truncate'>
                        {friend?.profile?.displayName ?? 'Unknown user'}
                    </h2>
                    <p className='flex gap-1 items-center text-sm text-neutral1'>
                        <FaCircle className='text-[6px] text-sky-400'/> Online
                    </p>
                </div>

            </div>

        </Card>
    )

}

export default FriendCard
