import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { request } from '../../shared/services/apiService'
import { useToast } from '../../shared/contexts/ToastContext'
import { useRewardFx } from '../economy/RewardFxContext'
import { useEconomy } from '../economy/EconomyContext'
import { getRarityGradient } from '../economy/utils/rarityUtils'
import QuestToast from './components/QuestToast'
import { diffQuests } from './utils/questPresentation.jsx'

const QuestContext = createContext({
    quests: [],
    loading: true,
    rerollsRemaining: 0,
    rerollsTotal: 1,
    refreshQuests: async () => {},
    reportQuestProgress: () => {},
    simulateQuestProgress: () => {},
    rerollQuest: async () => {},
    claimQuest: async () => {},
})

const localTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

const QuestProvider = ({ userId, children }) => {

    const { refresh: refreshEconomy } = useEconomy()
    const { showToast } = useToast()
    const { celebrateReward } = useRewardFx()

    const [quests, setQuests] = useState([])
    const [loading, setLoading] = useState(true)
    const [rerollsRemaining, setRerollsRemaining] = useState(0)
    const [rerollsTotal, setRerollsTotal] = useState(1)
    const questsRef = useRef([])

    const setBoard = useCallback((next) => {
        questsRef.current = next
        setQuests(next)
    }, [])

    const refreshQuests = useCallback(async () => {

        if(!userId) {
            setLoading(false)
            return
        }

        try {
            const board = await request({ path: `/v1/quests?timeZone=${encodeURIComponent(localTimeZone())}` })
            setBoard(board.quests ?? [])
            setRerollsRemaining(Math.max(0, Number(board.rerollsRemaining) || 0))
            setRerollsTotal(Math.max(1, Number(board.rerollsTotal) || 1))
        } catch {
            // A missing quest board should never block the page it sits on.
        } finally {
            setLoading(false)
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
                    // A completed toast holds the filled bar for a beat before swapping to the
                    // claim line, so it needs longer on screen than a plain progress one.
                    duration: quest.completed ? 5600 : 3200,
                    background: getRarityGradient(quest.rarity, 10),
                    // The quest toasts are short-lived status, not something to dismiss by hand.
                    canHide: false,
                })

            }, index * 320)
        })

    }, [setBoard, showToast])

    // A reroll replaces the board outright rather than folding in progress, so it deliberately
    // skips reportQuestProgress - there is nothing to announce and nothing advanced.
    const rerollQuest = useCallback(async (questId) => {

        const board = await request({
            path: '/v1/quests/reroll',
            method: 'POST',
            body: { questId, timeZone: localTimeZone() },
        })

        setBoard(board.quests ?? [])
        setRerollsRemaining(Math.max(0, Number(board.rerollsRemaining) || 0))
        setRerollsTotal(Math.max(1, Number(board.rerollsTotal) || 1))

        return board

    }, [setBoard])

    const claimQuest = useCallback(async (quest) => {
        const board = await request({ path: '/v1/quests/claim', method: 'POST',
            body: { questId: quest.id, instanceId: quest.instanceId, timeZone: localTimeZone() } })
        setBoard(board.quests ?? [])
        setRerollsRemaining(board.rerollsRemaining ?? 0)
        setRerollsTotal(board.rerollsTotal ?? 1)
        celebrateReward({ ...board.reward, scatter: true })
        await refreshEconomy()
        return board
    }, [setBoard, celebrateReward, refreshEconomy])

    // Advances the quest in one board slot for real through a local-only dev route, then announces
    // the result exactly as a match would. Development only.
    const simulateQuestProgress = useCallback(async (slot) => {

        const result = await request({
            path: '/v1/dev/quests/progress',
            method: 'POST',
            body: { slot, timeZone: localTimeZone() },
        })

        reportQuestProgress(result)

        return result

    }, [reportQuestProgress])

    const value = useMemo(() => ({
        quests,
        loading,
        simulateQuestProgress,
        rerollsRemaining,
        rerollsTotal,
        refreshQuests,
        reportQuestProgress,
        rerollQuest,
        claimQuest,
    }), [quests, loading, simulateQuestProgress, rerollsRemaining, rerollsTotal, refreshQuests, reportQuestProgress, rerollQuest, claimQuest])

    return <QuestContext.Provider value={value}>{children}</QuestContext.Provider>
}

const useQuests = () => useContext(QuestContext)

export { QuestProvider, useQuests }
