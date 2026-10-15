// A create acknowledgment may arrive before edits made while it was saving.
// Keep those edits, but let the server supply its own creation timestamps.
const pendingPatchAfterCreate = (serverTask, localTask = {}) => Object.fromEntries(
    Object.entries(localTask).filter(([key, value]) =>
        !['uid', 'createdAt', 'updatedAt'].includes(key) &&
        JSON.stringify(value) !== JSON.stringify(serverTask[key])
    )
)

export { pendingPatchAfterCreate }
