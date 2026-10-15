// React's disabled state is applied on the next render. This lock takes effect
// synchronously, including multiple clicks delivered before that render.
export const createGrandQuestClaimGuard = () => {
    let inFlight = false
    const claimed = new Set()
    return {
        start(key) {
            if (inFlight || claimed.has(key)) return false
            inFlight = true
            return true
        },
        markClaimed(key) { claimed.add(key) },
        hasClaimed(key) { return claimed.has(key) },
        finish() { inFlight = false },
    }
}
