import AvatarPicture from '../../../../shared/components/avatar/AvatarPicture'
import Button from '../../../../shared/components/ui/Button'

const FriendRequestToast = ({ requester, onAccept, onIgnore }) => {

    if(!requester) {
        return null
    }

    return (
        <div className='flex flex-col gap-3'>

            <div className='flex items-center gap-3 min-w-0'>
                <AvatarPicture profile={requester} className='w-12 h-12' />

                <p className='text-sm text-neutral0 min-w-0'>
                    <span className='font-semibold max-w-full'>
                        {requester?.profile?.displayName ?? 'Unknown user'}
                    </span>{' '}
                    <span className='font-normal'>wants to be friends!</span>
                </p>
            </div>

            <div className='flex items-center gap-2'>
                <Button type='secondary' className='flex-1 ' onClick={onIgnore}>
                    Ignore
                </Button>
                <Button type='primary' className='flex-1' onClick={onAccept}>
                    Accept
                </Button>
            </div>

        </div>
    )
}

export default FriendRequestToast