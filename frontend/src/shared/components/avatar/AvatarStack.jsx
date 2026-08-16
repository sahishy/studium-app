import AvatarPicture from './AvatarPicture'

const AvatarStack = ({
    users = [],
    totalCount = users.length,
    maxVisible = Number.POSITIVE_INFINITY,
    className = '',
    sizeClassName = 'w-8 h-8',
    overlapClassName = '-space-x-3',
    outlineClassName = 'outline-2 outline-neutral6',
}) => {
    const visibleUsers = users.filter(Boolean).slice(0, maxVisible)
    const overflowCount = Math.max(0, Number(totalCount || 0) - visibleUsers.length)
    if(!visibleUsers.length && !overflowCount) return null

    return (
        <div
            className={`flex items-center ${overlapClassName} ${className}`}
            aria-label={visibleUsers.map((user) => user?.displayName || user?.profile?.displayName || 'Player').join(', ')}
        >
            {visibleUsers.map((user, index) => {
                const profile = user?.profile
                    ? user
                    : { profile: { profilePicture: user?.profilePicture ?? null } }
                return (
                    <AvatarPicture
                        key={user?.userId ?? user?.uid ?? index}
                        profile={profile}
                        avatar={user?.avatar}
                        className={`${sizeClassName} rounded-full ${outlineClassName} bg-neutral6`}
                    />
                )
            })}
            {overflowCount > 0 ? (
                <div className={`${sizeClassName} rounded-full ${outlineClassName} bg-neutral5 flex shrink-0 items-center justify-center text-xs text-neutral1`}>
                    +{overflowCount}
                </div>
            ) : null}
        </div>
    )
}

export default AvatarStack
