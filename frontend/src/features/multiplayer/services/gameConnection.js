const arcadeActions = new Set(['game.chop', 'game.shoot', 'game.flutterInput'])

// One lifecycle owns readiness and transient input delivery. Nothing accumulates for socket.open.
export class GameConnection {
    constructor({ isOpen, transmit, now, userId, onReady = () => {}, onReset = () => {} }) {
        Object.assign(this, { isOpen, transmit, now, userId, onReady, onReset })
        this.state = 'connecting'
        this.sequence = 0
        this.snapshot = null
        this.freshSnapshot = false
        this.clockSample = false
        this.pendingLeave = false
    }
    opened() {
        this.state = 'syncing'
        this.freshSnapshot = false
        this.clockSample = false
    }
    beginSync() {
        const reset = this.freshSnapshot
        this.state = 'syncing'
        this.freshSnapshot = false
        if(reset) this.onReset()
    }
    closed() {
        this.state = 'connecting'
        this.freshSnapshot = false
        this.clockSample = false
        this.onReset()
    }
    receivedClock() { this.clockSample = true; this.maybeReady() }
    receivedSnapshot(snapshot, full = true) {
        const epoch = this.snapshot?.room?.state?.inputEpoch
        if(epoch != null && epoch !== snapshot?.room?.state?.inputEpoch) {
            this.state = 'syncing'
            this.freshSnapshot = false
            this.onReset()
        }
        this.snapshot = snapshot
        const player = snapshot.players?.find((p) => p.userId === this.userId())
        this.sequence = Math.max(this.sequence, Number(player?.state?.inputSequence) || 0)
        if(full) this.freshSnapshot = true
        this.maybeReady()
    }
    maybeReady() {
        if(!this.isOpen() || !this.freshSnapshot || !this.clockSample || this.state === 'ready') return
        this.state = 'ready'
        if(this.pendingLeave) this.send('game.leave')
        this.onReady()
    }
    send(type, payload = {}) {
        const open = this.isOpen() && this.freshSnapshot
        if(type === 'game.leave' && !open) {
            this.pendingLeave = true
            return { sent: false, reason: 'pending_leave' }
        }
        if(!open || arcadeActions.has(type) && !this.clockSample) return { sent: false, reason: 'not_ready' }
        const action = arcadeActions.has(type) || type === 'game.answer'
        let next = payload
        if(action && this.snapshot?.room?.state?.netcodeVersion >= 4) {
            const state = this.snapshot.room.state
            const sequence = Math.max(this.sequence + 1, Number(payload.sequence) || 0)
            next = { ...payload, sequence, occurredAt: payload.occurredAt ?? this.now(),
                inputEpoch: state.inputEpoch, roundToken: state.roundToken,
                ...(type === 'game.answer' ? { questionId: payload.questionId ?? state.currentQuestionId } : {}) }
            this.sequence = sequence
        }
        try {
            const id = this.transmit(type, next)
            if(type === 'game.leave') this.pendingLeave = false
            return { sent: true, id, payload: next }
        } catch {
            return { sent: false, reason: 'disconnected' }
        }
    }
}
