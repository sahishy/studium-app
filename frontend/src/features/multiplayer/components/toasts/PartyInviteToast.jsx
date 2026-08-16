import AvatarPicture from '../../../../shared/components/avatar/AvatarPicture'
import Button from '../../../../shared/components/ui/Button'

const PartyInviteToast = ({ invitation, onAccept, onIgnore }) => {
    if(!invitation) return null

    const inviter = {
        profile: {
            displayName: invitation.fromName,
            profilePicture: invitation.fromProfilePicture ?? null,
        },
    }

    return (
        <div className='flex flex-col gap-3'>
            <div className='flex items-center gap-3 min-w-0'>
                <AvatarPicture profile={inviter} className='w-12 h-12' />
                <p className='text-sm text-neutral0 min-w-0'>
                    <span className='font-semibold'>{invitation.fromName || 'A player'}</span>{' '}
                    <span className='font-normal'>invited you to a party!</span>
                </p>
            </div>
            <div className='flex items-center gap-2'>
                <Button type='secondary' className='flex-1' onClick={onIgnore}>Ignore</Button>
                <Button type='primary' className='flex-1' onClick={onAccept}>Join</Button>
            </div>
        </div>
    )
}

export default PartyInviteToast
