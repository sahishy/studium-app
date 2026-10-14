import { useOutletContext } from 'react-router-dom'
import { FaArrowTrendUp } from 'react-icons/fa6'
import Topbar from '../../../shared/components/ui/Topbar'
import PageHeader from '../../../shared/components/ui/PageHeader'
import QuestBoard from '../../quests/components/QuestBoard'
import { useEconomy } from '../../economy/EconomyContext'
import LevelRoadmap from '../components/LevelRoadmap'
import SkillWeb from '../components/SkillWeb'
import useMastery from '../useMastery'
import LoadingState from '../../../shared/components/ui/LoadingState'
import ErrorState from '../../../shared/components/ui/ErrorState'

const Progress = () => {

    const { profile } = useOutletContext()
    const { snapshot, error: economyError } = useEconomy()
    const { board: mastery, loading: masteryLoading } = useMastery(profile?.uid)

    const level = snapshot?.progress?.level ?? profile?.progress?.level ?? 1
    const xp = snapshot?.progress?.xp ?? profile?.progress?.xp ?? 0

    return (
        <div className='flex flex-col h-full overflow-hidden'>

            <Topbar profile={profile} />

            <div className='w-full flex-1 min-h-0 flex flex-col gap-4 px-4 pb-6 pt-2 sm:px-8 lg:px-16 xl:px-24'>

                <PageHeader text='Progress' icon={FaArrowTrendUp} />

                <div className='flex-1 min-h-0 flex flex-col gap-6 lg:flex-row'>

                    {/* Leave room for the path's +/-148px wave and its outer dots.
                        The character chooses the side with room inside the roadmap. */}
                    <div data-onboarding="progress:levels" className='w-full lg:w-[26rem] shrink-0 flex min-h-0 flex-col'>
                        {!snapshot ? (
                            economyError ? <ErrorState title='Could not load levels' description={economyError} /> : <LoadingState />
                        ) : <LevelRoadmap level={level} xp={xp} profile={profile} />}
                    </div>

                    {/* The horizontal padding is load-bearing: this is a scroll container, so it
                        clips at its padding edge, and a block nudged left with nothing to move into
                        had its heading sliced off. */}
                    <div className='flex-1 min-w-0 flex flex-col gap-10 overflow-y-auto no-scrollbar px-6 py-1'>
                        <div data-onboarding="progress:quests"><QuestBoard className='w-full max-w-[32rem] self-center' /></div>
                        <div data-onboarding="progress:mastery"><SkillWeb
                            board={mastery}
                            loading={masteryLoading}
                            className='w-full max-w-[28rem] self-center'
                        /></div>
                    </div>

                </div>

            </div>

        </div>
    )
}

export default Progress
