// Firestore refuses an array placed directly inside another array, and every expression in an
// interactive element is exactly that: ['op', '+', ['param', 'p'], ['num', 1]]. Rather than
// contort the grammar — which the evaluator, the validator and the builder all share — the
// nesting is packed at the storage boundary and unpacked on the way back.

const WRAPPER = '__a'

const packEntry = (entry) => (Array.isArray(entry) ? { [WRAPPER]: pack(entry) } : pack(entry))

export const pack = (value) => {
    if(Array.isArray(value)) return value.map(packEntry)
    if(value && typeof value === 'object' && !(value instanceof Date)) {
        return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, pack(entry)]))
    }
    return value
}

const isWrapped = (entry) => Boolean(entry) && typeof entry === 'object' && Array.isArray(entry[WRAPPER])

export const unpack = (value) => {
    if(Array.isArray(value)) return value.map((entry) => (isWrapped(entry) ? unpack(entry[WRAPPER]) : unpack(entry)))
    if(isWrapped(value)) return unpack(value[WRAPPER])
    if(value && typeof value === 'object' && !(value instanceof Date)) {
        return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, unpack(entry)]))
    }
    return value
}
