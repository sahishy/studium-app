// Background refreshes share a request. A refresh after a mutation must start
// after any older request, so an old balance can never overwrite a new one.
export const createSnapshotRefresher = ({ fetchSnapshot, onSnapshot, onError }) => {
    let running = null
    let queued = null
    let revision = 0
    let disposed = false

    const run = () => {
        const requestedRevision = ++revision
        running = Promise.resolve().then(fetchSnapshot).then(value => {
            if(!disposed && revision === requestedRevision) onSnapshot(value)
            return value
        }).catch(error => {
            if(!disposed && revision === requestedRevision) onError(error)
        }).finally(() => { running = null })
        return running
    }

    return {
        refresh: ({ fresh = true } = {}) => {
            if(disposed) return Promise.resolve()
            if(queued) return queued
            if(!running) return run()
            if(!fresh) return running
            revision += 1
            queued = running.then(() => {
                queued = null
                return disposed ? undefined : run()
            })
            return queued
        },
        dispose: () => { disposed = true; revision += 1 },
    }
}
