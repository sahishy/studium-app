// Mirrors backend/realtime/src/games/timber.ts's chop rule (`hit = branch === side`, and every
// chop - hit or miss - advances progress) so a local chop can be predicted immediately instead of
// waiting a full round trip. Kept honest by
// backend/realtime/src/games/timber-prediction-parity.test.js.
export const STUN_MS = 2_000
export const MIN_CHOP_INTERVAL_MS = 50
/** Branch rows drawn on the tree. Only a render budget now - prediction is no longer capped by it. */
export const VISIBLE_BRANCHES = 6

/**
 * Mirrors the server's branch generator (backend/realtime/src/games/timber.ts) so the client can
 * reproduce a round's whole sequence from the published `timberBranchSeed`. Prediction and the
 * local player's tree used to be driven by a six-row window pushed on every chop, which is
 * shallower than the queue of chops a fast player has in flight: predictions past its end read
 * undefined and silently became "miss", and the tree lost a row for each unconfirmed chop, popping
 * back when the acknowledgements landed. The window is still what draws the opponent's tree.
 */
export const generateBranchSequence = (seed, count = 80) => {
    let state = seed >>> 0 || 1
    const random = () => {
        state ^= state << 13
        state ^= state >>> 17
        state ^= state << 5
        return (state >>> 0) / 4294967296
    }
    let emptyRowsRemaining = 2
    return Array.from({ length: count }, () => {
        if(emptyRowsRemaining > 0) {
            emptyRowsRemaining -= 1
            return null
        }
        if(random() < 0.28) return null
        const branch = random() < 0.5 ? 'left' : 'right'
        const spacingRoll = random()
        emptyRowsRemaining = spacingRoll < 0.28 ? 1 : (spacingRoll < 0.72 ? 2 : 3)
        return branch
    })
}

/**
 * @param {('left'|'right'|null)[]} branches - the visible branch window (server's
 *   `visibleBranchesByUserId[userId]`), still anchored at the server's confirmed chop count.
 * @param {number} index - how many chops ahead of that confirmed count this predicted chop is.
 * @param {'left'|'right'} side
 */
export const predictChop = ({ branches, index, side }) => {
    const branch = branches[index] ?? null
    return { hit: branch === side }
}

/**
 * The pending chops that still need predicting on top of the server's confirmed count - i.e. those
 * the arriving snapshot does not already include.
 *
 * Must be derived at render time, not pruned in an effect. An effect lands a render late, so for
 * one committed frame the view would count a chop the snapshot already contained. TimberScene keys
 * every branch on its absolute index and eases it toward a row height, so a single frame of
 * overshoot shifts all six rows down one and unmounts the bottom branch - which remounts and
 * replays its drop-in. That is the branch jitter: a dip, a snap back, then a fall.
 */
export const activePendingChops = (pendingChops = [], serverActualChops = 0) => (
    pendingChops.filter((chop) => !(chop?.actualChops != null && chop.actualChops <= serverActualChops))
)
