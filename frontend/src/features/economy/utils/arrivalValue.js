// Resolves what a reward counter should read, given the wallet value and how
// much of a reward is still flying towards it.
//
// The wallet refresh and the animation are two independent clocks, and both
// orders happen in practice: `claimLevel`/`tip`/`openCrate` await the refresh
// *before* celebrating, so the server already includes the reward when the icons
// take off, while a match reward fires the refresh alongside the animation, so
// the server can still be behind when the last icon lands. Treating the credited
// amount as a delta on top of the server value therefore either double-counts or
// gets overwritten by a stale balance - the latter being why a reward could
// animate and leave the number untouched.
//
// So a hand-over is resolved against both readings, and the higher one wins:
// the server value net of what is still in flight, and the value that was on
// screen when the hand-over started plus what has actually landed since.
//
// The higher one only wins while the wallet has not moved since the hand-over
// began, though. Once it has, the refresh is demonstrably live and is the only
// reading that accounts for everything else the student did meanwhile - spending
// on a crate mid-animation, say. Keeping the maximum there would pin the counter
// to a pre-spend total that nothing afterwards contradicts, which is how the
// number could sit wrong while the wallet underneath it was right.

const createArrivalState = ({ display = 0, credited = 0, serverValue = null } = {}) => ({
    display,
    seenCredits: credited,
    lastServer: serverValue,
    // Set for as long as one hand-over is animating.
    burst: null,
})

const nextArrivalState = (state, { serverValue = null, pending = 0, credited = 0, followServer = true } = {}) => {

    const serverChanged = serverValue !== state.lastServer
    const landed = credited - state.seenCredits

    const next = {
        ...state,
        seenCredits: credited,
        lastServer: serverValue,
    }

    // A burst opens on the first pass that sees something in flight, and its
    // baseline is whatever the counter was already showing.
    const burst = (pending > 0 && !state.burst)
        ? { baseline: state.display, credited: credited - landed, serverMoved: false }
        : (state.burst && serverChanged ? { ...state.burst, serverMoved: true } : state.burst)

    if(burst) {
        // Closed on the same pass that drains it, so the last icon's landing
        // still counts towards the total below.
        next.burst = pending > 0 ? burst : null

        const landedTotal = burst.baseline + (credited - burst.credited)
        // A counter with followServer off (the crate slot mid-gain) is handing
        // over a number the wallet has already moved past, and says so: it
        // climbs purely from what has landed.
        const tracksServer = followServer && serverValue != null
        const fromServer = tracksServer ? serverValue - pending : landedTotal
        // With a moved wallet the refresh is the truth; the landed total is only
        // a stand-in for a refresh that has not arrived yet.
        next.display = burst.serverMoved && tracksServer ? fromServer : Math.max(fromServer, landedTotal)
        return next
    }

    if(!followServer || serverValue == null) return next

    // No animation is carrying this change: either the counter is being synced
    // (a spend, a correction) or an icon was credited outright because it had
    // nowhere to fly to. The wallet is the truth in both cases.
    if(serverChanged || landed > 0) next.display = serverValue

    return next
}

export { createArrivalState, nextArrivalState }
