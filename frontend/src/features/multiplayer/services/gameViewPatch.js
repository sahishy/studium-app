// Client-side mirror of backend/realtime/src/servers/game-view.ts's diff shape. Pure and
// dependency-free (no PartySocket/Firebase) so it's directly testable - see gameViewPatch.test.js.

// A {status?, ...stateFields} patch: `status` merges into room.status, every other key merges
// into room.state (null deletes that key).
const applyRoomPatch = (room, patch) => {
    if(!patch) return room
    const { status, ...statePatch } = patch
    const nextState = { ...room.state }
    for(const [key, value] of Object.entries(statePatch)) {
        if(value === null) delete nextState[key]
        else nextState[key] = value
    }
    return { ...room, ...(status !== undefined ? { status } : {}), state: nextState }
}

const applyStatePatch = (state, patch) => {
    if(!patch) return state
    const next = { ...state }
    for(const [key, value] of Object.entries(patch)) {
        if(value === null) delete next[key]
        else next[key] = value
    }
    return next
}

const appendById = (existing = [], incoming = [], idKey = 'uid') => {
    if(!incoming.length) return existing
    const ids = new Set(existing.map((entry) => entry[idKey]))
    return [...existing, ...incoming.filter((entry) => !ids.has(entry[idKey]))]
}

export { applyRoomPatch, applyStatePatch, appendById }
