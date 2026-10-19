export const shouldReturnToPlay = ({ session, roomId, roomLoading, playersLoading, isGameFinished, players = [], userId }) => {
    if(!session || roomLoading || playersLoading || isGameFinished) return false
    if(session.status === 'in_room' && session.currentRoomId === roomId) return false

    // Session and game updates use different sockets. A finished game's session can
    // become idle before its final snapshot arrives; membership keeps results open.
    const isParticipant = Boolean(userId) && players.some((player) => player.userId === userId)
    return !isParticipant || (session.status === 'in_room' && Boolean(session.currentRoomId))
}
