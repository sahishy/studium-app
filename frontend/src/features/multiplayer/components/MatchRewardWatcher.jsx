import { useEffect, useRef } from 'react'
import { subscribeToGameSnapshot } from '../services/realtimeSocketService'
import { useEconomy } from '../../economy/EconomyContext'
import { useRewardFx } from '../../economy/RewardFxContext'
import { invalidateGamificationCache } from '../../../shared/services/gamificationCache'
import { useQuests } from '../../quests/QuestContext'

// Match rewards are granted by the backend when the result is committed, so the
// client never awards anything here: it only plays the animation for what the
// end-of-game event says was already paid out.
const MatchRewardWatcher = ({ roomId, userId }) => {

    const { refresh } = useEconomy()
    const { celebrateReward } = useRewardFx()
    const { reportQuestProgress } = useQuests()

    const announcedGamesRef = useRef(new Set())

    useEffect(() => {

        if(!roomId || !userId) return undefined

        return subscribeToGameSnapshot(roomId, (snapshot) => {

            const endedEvent = [...(snapshot?.events ?? [])]
                .reverse()
                .find((event) => event?.type === 'GAME_ENDED')

            const reward = endedEvent?.data?.rewardsByUserId?.[userId]

            if(!reward) return

            const gameId = snapshot?.room?.id ?? roomId

            if(announcedGamesRef.current.has(gameId)) return

            announcedGamesRef.current.add(gameId)
            invalidateGamificationCache(userId)

            if(reward.xp || reward.lumen) {
                celebrateReward({ xp: reward.xp, lumen: reward.lumen, scatter: true })
                refresh()
            }

            reportQuestProgress(endedEvent.data.questsByUserId?.[userId])

        })

    }, [celebrateReward, refresh, reportQuestProgress, roomId, userId])

    return null
}

export default MatchRewardWatcher
