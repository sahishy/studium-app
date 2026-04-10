import defaultProfilePicture from '../../../assets/images/default-profile.jpg'

const AvatarPicture = ({ profile, className = '', children }) => {
    const profilePictureUrl = `${profile?.profile?.profilePicture?.url}?v=${profile?.profile?.profilePicture?.lastUpdated}` || defaultProfilePicture

    return (
        <div className={`relative w-8 h-8 shrink-0 ${className}`}>
            <img
                src={profilePictureUrl}
                alt="profile picture"
                className="w-full h-full rounded-full object-cover select-none pointer-events-none"
            />
            {/* <span
                className={`absolute bottom-0 right-0 w-3 h-3 ${statusColorClass} border-2 ${isOpen ? 'border-background4' : 'border-background0'} group-hover:border-background4 rounded-full transition-colors`}
            ></span> */}
            {children}
        </div>
    )
}

export default AvatarPicture