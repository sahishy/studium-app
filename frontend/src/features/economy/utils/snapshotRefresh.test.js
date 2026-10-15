import assert from 'node:assert/strict'
import test from 'node:test'
import { createSnapshotRefresher } from './snapshotRefresh.js'

const deferred = () => {
    let resolve, reject
    const promise = new Promise((res,rej)=>{ resolve=res; reject=rej })
    return { promise, resolve, reject }
}
const fixture = () => {
    const pending = [], snapshots = [], errors = []
    const refresher = createSnapshotRefresher({
        fetchSnapshot: () => { const next=deferred(); pending.push(next); return next.promise },
        onSnapshot: value=>snapshots.push(value), onError: error=>errors.push(error.message),
    })
    return { pending, snapshots, errors, ...refresher }
}

test('simultaneous background refreshes make one request', async () => {
    const f=fixture(), first=f.refresh({fresh:false}), second=f.refresh({fresh:false})
    assert.equal(first,second)
    await Promise.resolve()
    assert.equal(f.pending.length,1)
    f.pending[0].resolve({balance:10})
    await first
    assert.deepEqual(f.snapshots,[{balance:10}])
})

test('mutation refreshes share one queued request and discard an older balance', async () => {
    const f=fixture(), old=f.refresh({fresh:false})
    await Promise.resolve()
    const fresh=f.refresh(), alsoFresh=f.refresh()
    assert.equal(fresh,alsoFresh)
    f.pending[0].resolve({balance:100})
    await old
    await Promise.resolve()
    assert.deepEqual(f.snapshots,[])
    assert.equal(f.pending.length,2)
    f.pending[1].resolve({balance:75})
    await fresh
    assert.deepEqual(f.snapshots,[{balance:75}])
})

test('a failed older request does not block the queued refresh', async () => {
    const f=fixture(), old=f.refresh({fresh:false})
    await Promise.resolve()
    const fresh=f.refresh()
    f.pending[0].reject(new Error('old failure'))
    await old
    await Promise.resolve()
    f.pending[1].resolve({balance:50})
    await fresh
    assert.deepEqual(f.errors,[])
    assert.deepEqual(f.snapshots,[{balance:50}])
})

test('switching accounts discards in-flight and queued results', async () => {
    const f=fixture(), old=f.refresh()
    await Promise.resolve()
    const queued=f.refresh()
    f.dispose()
    f.pending[0].resolve({balance:999})
    await Promise.all([old,queued])
    assert.equal(f.pending.length,1)
    assert.deepEqual(f.snapshots,[])
    await f.refresh()
    assert.equal(f.pending.length,1)
})
