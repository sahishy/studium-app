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
        <div className='flex flex-col h-full overflow-y-auto lg:overflow-hidden'>

            <Topbar profile={profile} />

            <div className='w-full flex-1 lg:min-h-0 flex flex-col gap-4 px-4 pb-6 pt-2 sm:px-8 lg:px-16 xl:px-24'>

                <PageHeader text='Progress' icon={FaArrowTrendUp} />

                <div className='flex-1 lg:min-h-0 flex flex-col gap-6 lg:flex-row'>

                    {/* Mobile shows a fixed three-level preview above quests and skills. */}
                    <div data-onboarding="progress:levels" className='order-1 w-full lg:w-[26rem] h-80 lg:h-auto shrink-0 flex min-h-0 flex-col'>
                        {!snapshot ? (
                            economyError ? <ErrorState title='Could not load levels' description={economyError} /> : <LoadingState />
                        ) : <LevelRoadmap level={level} xp={xp} profile={profile} />}
                    </div>

                    {/* The horizontal padding is load-bearing: this is a scroll container, so it
                        clips at its padding edge, and a block nudged left with nothing to move into
                        had its heading sliced off. */}
                    <div className='contents lg:flex lg:order-2 lg:flex-1 lg:min-w-0 lg:flex-col lg:gap-10 lg:overflow-y-auto no-scrollbar lg:px-6 lg:py-1'>
                        <div data-onboarding="progress:quests" className="order-2 lg:order-1 shrink-0 flex justify-center"><QuestBoard className='w-full max-w-[32rem] self-center' /></div>
                        <div data-onboarding="progress:mastery" className="order-3 shrink-0 flex justify-center"><SkillWeb
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
