import { useMemo, useState } from 'react'
import { FaArrowLeft } from 'react-icons/fa6'
import Button from '../../../shared/components/ui/Button'
import Card from '../../../shared/components/ui/Card'
import ProgressBar from '../../../shared/components/ui/ProgressBar'
import TextTabSelector from '../../../shared/components/ui/TextTabSelector'
import { useUserStats } from '../../profile/contexts/UserStatsContext'
import { buildMultiplayerUiState } from '../utils/multiplayerUtils'
import { getRankInfoFromElo } from '../../profile/utils/statsUtils'

import classic_thumbnail from '../../../assets/images/gamemodes/classic.jpg'
import timber_thumbnail from '../../../assets/images/gamemodes/timber.jpg'
import puncture_thumbnail from '../../../assets/images/gamemodes/puncture.jpg'
import flutter_thumbnail from '../../../assets/images/gamemodes/flutter.jpg'

const TABS = [
    { name: 'multiplayer', label: 'Multiplayer' },
    { name: 'singleplayer', label: 'Singleplayer' },
]

const MODE_THUMBNAILS = {
    'sat-classic': classic_thumbnail,
    'sat-timber': timber_thumbnail,
    'sat-puncture': puncture_thumbnail,
    'sat-flutter': flutter_thumbnail,
}

const GameModeTab = ({ modes = [], selectedModeId, onSelectMode, onBack }) => {

    const { userStats } = useUserStats()
    const selectedMode = modes.find((mode) => mode.id === selectedModeId)
    const defaultTab = selectedMode?.type === 'singleplayer' ? 'singleplayer' : 'multiplayer'
    const [activeTab, setActiveTab] = useState(defaultTab)
    const activeTabIndex = TABS.findIndex((tab) => tab.name === activeTab)

    const visibleModes = useMemo(() => {
        return modes.filter((mode) => mode.type === activeTab)
    }, [modes, activeTab])

    return (
        <div className='w-full px-8 xl:px-24 pb-12 pt-2'>
            <div className='w-full max-w-6xl mx-auto flex flex-col gap-8 min-h-full'>

                <div className='relative flex items-center justify-between gap-6'>
                    <Button onClick={onBack} aria-label='Back to lobby'>
                        <FaArrowLeft />
                        Back
                    </Button>

                    <TextTabSelector
                        tabs={TABS}
                        currentIndex={Math.max(0, activeTabIndex)}
                        onSelect={(tab) => setActiveTab(tab.name)}
                        className='absolute left-1/2 -translate-x-1/2 w-full max-w-xs'
                    />

                    <div className='w-24' aria-hidden='true' />
                </div>

                <div className='grid grid-cols-3 gap-8'>
                    {visibleModes.map((mode) => {
                        const isSelected = mode.id === selectedModeId
                        const ModeIcon = mode.icon
                        const rankedProgression = mode.ranked
                            ? buildMultiplayerUiState({ userStats, modeId: mode.id })
                            : null
                        const nextRankInfo = rankedProgression?.nextTierThreshold
                            ? getRankInfoFromElo(rankedProgression.nextTierThreshold.minElo)
                            : rankedProgression?.rankInfo

                        return (
                            <button
                                key={mode.id}
                                type='button'
                                className='text-left min-w-0 h-full'
                                onClick={() => onSelectMode?.(mode.id)}
                                aria-pressed={isSelected}
                            >
                                <Card
                                    hoverable
                                    className={`p-6! h-full gap-0! border-2 outline-4 transition overflow-hidden
                                        ${isSelected ? 'border-neutral0 outline-neutral5' : 'border-neutral4 outline-transparent'}
                                    `}
                                >

                                    <div className={`absolute -top-48 left-1/2 -translate-x-1/2 bg-radial from-[#0EA5E9] to-transparent to-60% w-full scale-x-150 aspect-square
                                        opacity-0 group-hover/card:opacity-10 transition
                                    `} />

                                    <div className='relative w-full aspect-[16/10] mb-8'>
                                        <img src={MODE_THUMBNAILS[mode.id]} className='w-full h-full object-cover border border-neutral4 rounded group-hover/card:scale-102 transition-transform' />
                                        <div className='absolute -bottom-5 left-1/2 -translate-x-1/2 w-12 h-12 rounded-xl bg-neutral5 outline-8 outline-white flex items-center justify-center'>
                                            <ModeIcon className='text-2xl text-neutral1' />
                                        </div>
                                    </div>

                                    <p className='text-2xl text-center font-semibold'>{mode.name}</p>

                                    {rankedProgression ? (
                                        <div className='w-[12em] flex flex-col items-center self-center'>


                                            <div className='relative w-full flex items-center justify-center gap-1'>

                                                <div className='flex items-center justify-center w-6 h-6'>
                                                    <img
                                                        src={rankedProgression.rankInfo.imageSrc}
                                                        alt={`${rankedProgression.rankLabel} icon`}
                                                        className='absolute w-8 h-8 object-cover shrink-0'
                                                    />
                                                </div>
                                                <p className='text-sm font-semibold'>
                                                    {rankedProgression.rankedStats.elo}{' '}
                                                    <span className='text-xs font-medium text-neutral1'>SAT</span>
                                                </p>

                                            </div>
                                        </div>
                                    ) : null}

                                    <p className='mt-4 mb-2 text-sm text-neutral1 leading-relaxed'>{mode.description}</p>


                                </Card>
                            </button>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

export default GameModeTab
