export const initialMatchEntryState = { session: null, pendingMatch: null, lastRoomId: null }

export function getMatchRedirectPath({ session, pendingMatch }, pathname) {
    const roomId = session?.status === 'in_room' ? session.currentRoomId : null
    if(!roomId || pendingMatch?.roomId === roomId) return null
    const roomPath = `/play/game/${roomId}`
    return pathname === roomPath ? null : roomPath
}

export function matchEntryReducer(state, action) {
    if(action.type === 'entered') {
        return state.pendingMatch?.roomId === action.roomId
            ? { ...state, pendingMatch: null }
            : state
    }
    if(action.type !== 'snapshot') return state

    const session = action.session
    const roomId = session?.status === 'in_room' ? session.currentRoomId : null
    const isNewRoom = Boolean(roomId && roomId !== state.lastRoomId)
    // An initial snapshot restores an existing game immediately. Subsequent new
    // multiplayer assignments get exactly one countdown, including instant matches.
    const pendingMatch = isNewRoom
        ? (state.session && action.delayEntry ? { roomId, deadline: action.now + action.delayMs } : null)
        : (roomId ? state.pendingMatch : null)

    return { session, pendingMatch, lastRoomId: roomId || state.lastRoomId }
}
