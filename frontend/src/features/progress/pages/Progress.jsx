import { useOutletContext } from 'react-router-dom'
import { FaArrowTrendUp } from 'react-icons/fa6'
import Topbar from '../../../shared/components/ui/Topbar'
import PageHeader from '../../../shared/components/ui/PageHeader'
import QuestBoard from '../../quests/components/QuestBoard'
import { useEconomy } from '../../economy/EconomyContext'
import LevelRoadmap from '../components/LevelRoadmap'
import StreakCard from '../components/StreakCard'

const Progress = () => {

    const { profile } = useOutletContext()
    const { snapshot } = useEconomy()

    const level = snapshot?.progress?.level ?? profile?.progress?.level ?? 1
    const xp = snapshot?.progress?.xp ?? profile?.progress?.xp ?? 0
    const streak = profile?.progress?.streak ?? 0

    return (
        <div className='flex flex-col h-full overflow-hidden'>

            <Topbar profile={profile} />

            <div className='w-full flex-1 min-h-0 flex flex-col gap-4 px-4 pb-6 pt-2 sm:px-8 lg:px-16 xl:px-24'>

                <PageHeader text='Progress' icon={FaArrowTrendUp} />

                <div className='flex-1 min-h-0 flex flex-col gap-6 lg:flex-row'>

                    <LevelRoadmap level={level} xp={xp} profile={profile} />

                    <div className='w-full lg:max-w-[20rem] shrink-0 flex flex-col gap-4 overflow-y-auto no-scrollbar'>
                        <QuestBoard />
                        <StreakCard streak={streak} />
                    </div>

                </div>

            </div>

        </div>
    )
}

export default Progress
