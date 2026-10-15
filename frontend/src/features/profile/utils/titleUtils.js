// Mirrors TITLE_CATALOG in backend/functions/src/features/economy/economyService.js. The backend
// is authoritative for ownership and equipping; this copy only exists so a title can be rendered
// without waiting on the economy snapshot.
const TITLE_CATALOG = Object.freeze([
    { id: 'title-novice', name: 'The Novice', rarity: 'Common' },
    { id: 'title-student', name: 'The Student', rarity: 'Common' },
    { id: 'title-freshman', name: 'The Freshman', rarity: 'Common' },
    { id: 'title-note-taker', name: 'The Note Taker', rarity: 'Common' },
    { id: 'title-early-bird', name: 'The Early Bird', rarity: 'Common' },
    { id: 'title-doodler', name: 'The Doodler', rarity: 'Common' },

    { id: 'title-bookworm', name: 'The Bookworm', rarity: 'Uncommon' },
    { id: 'title-overachiever', name: 'The Overachiever', rarity: 'Uncommon' },
    { id: 'title-caffeinated', name: 'The Caffeinated', rarity: 'Uncommon' },
    { id: 'title-night-owl', name: 'The Night Owl', rarity: 'Uncommon' },
    { id: 'title-quick-thinker', name: 'The Quick Thinker', rarity: 'Uncommon' },
    { id: 'title-study-buddy', name: 'The Study Buddy', rarity: 'Uncommon' },

    { id: 'title-scholar', name: 'The Scholar', rarity: 'Rare' },
    { id: 'title-mathlete', name: 'The Mathlete', rarity: 'Rare' },
    { id: 'title-wordsmith', name: 'The Wordsmith', rarity: 'Rare' },
    { id: 'title-curve-breaker', name: 'The Curve Breaker', rarity: 'Rare' },
    { id: 'title-unshakeable', name: 'The Unshakeable', rarity: 'Rare' },
    { id: 'title-tutor', name: 'The Tutor', rarity: 'Rare' },

    { id: 'title-prodigy', name: 'The Prodigy', rarity: 'Epic' },
    { id: 'title-valedictorian', name: 'The Valedictorian', rarity: 'Epic' },
    { id: 'title-mastermind', name: 'The Mastermind', rarity: 'Epic' },
    { id: 'title-human-calculator', name: 'The Human Calculator', rarity: 'Epic' },

    { id: 'title-1601-scorer', name: '1601 Scorer', rarity: 'Legendary', earned: true },
    { id: 'title-undefeated', name: 'The Undefeated', rarity: 'Legendary', earned: true },
    { id: 'title-immortal', name: 'The Immortal', rarity: 'Legendary', earned: true },
])

const DEFAULT_TITLE_ID = 'title-novice'

// Gradients for the travelling sheen, one per rarity above Common. The mid stop is the bright
// band that sweeps across; the outer stops are the rarity's resting colour.
const TITLE_RARITY_SHINE = Object.freeze({
    Uncommon: 'bg-[linear-gradient(110deg,var(--color-green-500)_35%,var(--color-green-200)_50%,var(--color-green-500)_65%)]',
    Rare: 'bg-[linear-gradient(110deg,var(--color-sky-500)_35%,var(--color-sky-200)_50%,var(--color-sky-500)_65%)]',
    Epic: 'bg-[linear-gradient(110deg,var(--color-fuchsia-500)_35%,var(--color-fuchsia-200)_50%,var(--color-fuchsia-500)_65%)]',
    Legendary: 'bg-[linear-gradient(110deg,var(--color-amber-500)_35%,var(--color-amber-100)_50%,var(--color-amber-500)_65%)]',
})

const titleById = (id) => TITLE_CATALOG.find((title) => title.id === id) ?? null

// Falls back to The Novice, which every account owns, so a profile never shows a blank line where
// a title should be.
const describeTitle = (id) => titleById(id) ?? titleById(DEFAULT_TITLE_ID)

const titlesByRarity = (rarity) => TITLE_CATALOG.filter((title) => title.rarity === rarity)

export {
    DEFAULT_TITLE_ID,
    TITLE_CATALOG,
    TITLE_RARITY_SHINE,
    describeTitle,
    titleById,
    titlesByRarity,
}
