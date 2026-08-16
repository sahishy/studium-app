import AvatarPicture from '../../../../../../shared/components/avatar/AvatarPicture'

const SatClassicSubmittedToast = ({ submitterName = 'A player', profilePicture = null, avatar = null }) => {

    return (
        <div className='flex items-center gap-3'>
            <AvatarPicture
                profile={{ profile: { profilePicture } }}
                avatar={avatar}
                className='w-10 h-10'
            />
            <p className='text-sm text-neutral0'>{submitterName} has submitted an answer.</p>
        </div>
    )

}

export default SatClassicSubmittedToast
