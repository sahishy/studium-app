const RARITY_ORDER = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary']

const RARITY_STYLES = {
    Common: {
        tint: 'bg-neutral2/10',
        text: 'text-neutral2',
        bar: 'bg-neutral2',
        chip: 'bg-neutral5 text-neutral1',
        glow: 'shadow-neutral2/40',
        ring: 'border-neutral3',
    },
    Uncommon: {
        tint: 'bg-green-400/10',
        text: 'text-green-400',
        bar: 'bg-green-400',
        chip: 'bg-green-400/15 text-green-500',
        glow: 'shadow-green-400/50',
        ring: 'border-green-400',
    },
    Rare: {
        tint: 'bg-sky-400/10',
        text: 'text-sky-400',
        bar: 'bg-sky-400',
        chip: 'bg-sky-400/15 text-sky-500',
        glow: 'shadow-sky-400/50',
        ring: 'border-sky-400',
    },
    Epic: {
        tint: 'bg-fuchsia-300/10',
        text: 'text-fuchsia-300',
        bar: 'bg-fuchsia-300',
        chip: 'bg-fuchsia-400/15 text-fuchsia-500',
        glow: 'shadow-fuchsia-400/60',
        ring: 'border-fuchsia-400',
    },
    Legendary: {
        tint: 'bg-amber-200/10',
        text: 'text-amber-400',
        bar: 'bg-amber-400',
        chip: 'bg-amber-400/15 text-amber-500',
        glow: 'shadow-amber-400/70',
        ring: 'border-amber-400',
    },
}

const getRarityStyle = (rarity) => RARITY_STYLES[rarity] ?? RARITY_STYLES.Common

const formatColorName = (id = '') => id.charAt(0).toUpperCase() + id.slice(1)

// The four colours every student starts with are not in the crate catalog, but
// they still need a name wherever a cosmetic is labelled.
const STARTER_COLOR_NAMES = {
    '#fcd34d': 'Yellow',
    '#22c55e': 'Green',
    '#60a5fa': 'Blue',
    '#f87171': 'Red',
}

const describeColor = (value, catalogItem = null) => catalogItem
    ? { name: formatColorName(catalogItem.id), rarity: catalogItem.rarity }
    : { name: STARTER_COLOR_NAMES[value] ?? 'Starter', rarity: 'Common' }

const STARTER_FACE_NAMES = { 0: 'Happy', 1: 'Angry', 2: 'Sad' }

const describeFace = (faceIndex, catalogItem = null) => catalogItem
    ? { name: catalogItem.name, rarity: catalogItem.rarity }
    : { name: STARTER_FACE_NAMES[faceIndex] ?? 'Face', rarity: 'Common' }

export { RARITY_ORDER, RARITY_STYLES, STARTER_COLOR_NAMES, STARTER_FACE_NAMES, describeColor, describeFace, formatColorName, getRarityStyle }
