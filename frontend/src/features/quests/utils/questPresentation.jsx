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

// Returns the quests whose progress moved, paired with where they started,
// so a toast can animate the bar from the old value to the new one.
const diffQuests = (previousQuests = [], nextQuests = []) => {

    const previousById = new Map(previousQuests.map((quest) => [quest.id, quest]))

    return nextQuests
        .map((quest) => ({ quest, previous: previousById.get(quest.id)?.current ?? 0 }))
        .filter(({ quest, previous }) => quest.current > previous)
}

export { QUEST_GROUP_ICONS, QUEST_GROUP_LABELS, diffQuests }
