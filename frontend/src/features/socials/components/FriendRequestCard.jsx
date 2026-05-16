import Button from '../../../shared/components/ui/Button'
import Card from '../../../shared/components/ui/Card'
import AvatarPicture from '../../../shared/components/avatar/AvatarPicture'
import { FaCircle } from 'react-icons/fa6'

const FriendRequestCard = ({ request, onAccept, onIgnore }) => {
    const requester = request?.fromUser

    if (!requester) {
        return null
    }

    return (
        <Card className='gap-3'>

            <div className='flex items-center gap-3 min-w-0'>

                <AvatarPicture profile={requester} className='w-16 h-16' />

                <div className='flex flex-col'>
                    <h2 className='text-sm font-semibold text-neutral0 truncate'>
                        {requester?.profile?.displayName ?? 'Unknown user'}
                    </h2>
                    <p className='flex gap-1 items-center text-sm text-neutral1'>
                        <FaCircle className='text-[6px] text-sky-400'/> Online
                    </p>
                </div>

            </div>

            <div className='flex items-center gap-2'>
                <Button type='secondary' className='flex-1' onClick={() => onIgnore?.(request)}>
                    Ignore
                </Button>
                <Button type='primary' className='flex-1' onClick={() => onAccept?.(request)}>
                    Accept
                </Button>
            </div>
        </Card>
    )
}

export default FriendRequestCard
