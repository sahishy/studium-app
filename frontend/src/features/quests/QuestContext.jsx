import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { request } from '../../shared/services/apiService'
import { useToast } from '../../shared/contexts/ToastContext'
import { useRewardFx } from '../economy/RewardFxContext'
import QuestToast from './components/QuestToast'
import { diffQuests } from './utils/questPresentation.jsx'

const QuestContext = createContext({
    quests: [],
    refreshQuests: async () => {},
    reportQuestProgress: () => {},
})

const QuestProvider = ({ userId, children }) => {

    const { showToast } = useToast()
    const { celebrateReward } = useRewardFx()

    const [quests, setQuests] = useState([])
    const questsRef = useRef([])

    const setBoard = useCallback((next) => {
        questsRef.current = next
        setQuests(next)
    }, [])

    const refreshQuests = useCallback(async () => {

        if(!userId) return

        try {
            const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
            const board = await request({ path: `/v1/quests?timeZone=${encodeURIComponent(timeZone)}` })
            setBoard(board.quests ?? [])
        } catch {
            // A missing quest board should never block the page it sits on.
        }

    }, [setBoard, userId])

    useEffect(() => { refreshQuests() }, [refreshQuests])

    // Any API response that carries a `quests` board folds into the local one and
    // announces whatever moved, so progress is shown wherever the action happened.
    const reportQuestProgress = useCallback((payload) => {

        const nextQuests = payload?.quests

        if(!Array.isArray(nextQuests) || !nextQuests.length) return

        const moved = diffQuests(questsRef.current, nextQuests)
        setBoard(nextQuests)

        moved.forEach(({ quest, previous }, index) => {
            window.setTimeout(() => {
                showToast({
                    component: QuestToast,
                    props: { quest, previous },
                    duration: quest.completed ? 4200 : 3200,
                })

                if(quest.completed) {
                    celebrateReward({ xp: quest.xp, lumen: quest.lumen, scatter: true })
                }
            }, index * 320)
        })

    }, [celebrateReward, setBoard, showToast])

    const value = useMemo(() => ({
        quests,
        refreshQuests,
        reportQuestProgress,
    }), [quests, refreshQuests, reportQuestProgress])

    return <QuestContext.Provider value={value}>{children}</QuestContext.Provider>
}

const useQuests = () => useContext(QuestContext)

export { QuestProvider, useQuests }
