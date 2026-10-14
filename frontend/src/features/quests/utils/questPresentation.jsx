import { FaBookOpen, FaGamepad, FaListCheck } from 'react-icons/fa6'

const QUEST_GROUP_ICONS = {
    study: <FaListCheck />,
    play: <FaGamepad />,
    share: <FaBookOpen />,
}

const QUEST_GROUP_LABELS = {
    study: 'Study',
    play: 'Play',
    share: 'Share',
}

// Fixed per board slot rather than randomised: a random tilt would change on every re-render,
// so the cards would visibly jump each time quest progress came back from the server. The
// staggered delays keep the three cards from floating in lockstep.
const QUEST_CARD_TILTS = [
    { rotate: -3, delay: 0 },
    { rotate: 2, delay: 900 },
    { rotate: -1.5, delay: 1800 },
]

// Returns the quests whose progress moved, paired with where they started,
// so a toast can animate the bar from the old value to the new one.
const diffQuests = (previousQuests = [], nextQuests = []) => {

    const previousById = new Map(previousQuests.map((quest) => [quest.id, quest]))

    return nextQuests
        .map((quest) => ({ quest, previous: previousById.get(quest.id)?.current ?? 0 }))
        .filter(({ quest, previous }) => quest.current > previous)
}

export { QUEST_CARD_TILTS, QUEST_GROUP_ICONS, QUEST_GROUP_LABELS, diffQuests }
