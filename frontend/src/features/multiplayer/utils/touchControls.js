export const NEUTRAL_INPUT = Object.freeze({ up: false, down: false, left: false, right: false })
const DIRECTIONS = Object.keys(NEUTRAL_INPUT)

export const joystickInput = (x, y, radius = 48) => {
    const length = Math.hypot(x, y)
    const scale = length > radius ? radius / length : 1
    const thumb = { x: x * scale, y: y * scale }
    if(length <= radius * 0.2) return { thumb, input: { ...NEUTRAL_INPUT } }
    // A wide cardinal sector avoids accidental diagonals while still allowing eight directions.
    const threshold = length * Math.sin(Math.PI / 8)
    return { thumb, input: { up: -y > threshold, down: y > threshold, left: -x > threshold, right: x > threshold } }
}

export const createDirectionalInput = (onChange) => {
    let sources = {}
    let current = { ...NEUTRAL_INPUT }
    const publish = () => {
        const next = Object.fromEntries(DIRECTIONS.map((key) => [key, Object.values(sources).some((input) => input[key])]))
        if(DIRECTIONS.some((key) => next[key] !== current[key])) {
            current = next
            onChange(next)
        }
    }
    return {
        set(source, input) { sources[source] = input; publish() },
        reset() { sources = {}; publish() },
    }
}

export const canChop = ({ active, readOnly, now, stunnedUntil, lastChopAt, interval }) => (
    active && !readOnly && now >= stunnedUntil && now - lastChopAt >= interval
)

export const isArenaTap = (event) => event.type === 'pointerdown' && event.isPrimary !== false && event.button === 0
    && !event.target?.closest?.('button, a, input, textarea, select, [role="button"], [data-opponent-preview], [role="dialog"]')
