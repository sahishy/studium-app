const MULTIPLAYER_MODE_IDS = new Set(['sat-classic', 'sat-timber', 'sat-puncture', 'sat-flutter'])

const getSpectateAvailability = ({ currentUserId, targetProfile, session }) => {
    const activity = targetProfile?.activity
    const isOtherActiveUser = Boolean(targetProfile?.uid)
        && targetProfile.uid !== currentUserId
        && targetProfile?.status === 'active'
    const isActiveMultiplayerGame = activity?.state === 'in_game'
        && MULTIPLAYER_MODE_IDS.has(activity?.modeId)
        && Boolean(activity?.roomId)

    return {
        visible: isOtherActiveUser && isActiveMultiplayerGame,
        disabled: session?.status === 'queue',
        roomId: isActiveMultiplayerGame ? activity.roomId : null,
    }
}

export { getSpectateAvailability }
