import Logo from '../../../../shared/components/misc/Logo'
import Card from '../../../../shared/components/ui/Card'
import TextTabSelector from '../../../../shared/components/ui/TextTabSelector'
import { useMemo, useState } from 'react'

const TABS = [
    { name: 'multiplayer', label: 'Multiplayer' },
    { name: 'singleplayer', label: 'Singleplayer' },
]

const GameModeModal = ({ modes = [], selectedModeId, onSelectMode, closeModal }) => {

    const selectedMode = modes.find((mode) => mode.id === selectedModeId)
    const defaultTab = selectedMode?.type === 'singleplayer' ? 'singleplayer' : 'multiplayer'
    const [activeTab, setActiveTab] = useState(defaultTab)
    const activeTabIndex = TABS.findIndex((tab) => tab.name === activeTab)

    const visibleModes = useMemo(() => {
        return modes.filter((mode) => mode.type === activeTab)
    }, [modes, activeTab])

    return (
        <div className='flex flex-col gap-8'>

            <h2 className='text-3xl font-semibold flex gap-4 items-center justify-center'>
                <Logo className={'w-6! mb-1'}/>
                SAT Games
            </h2>

            <TextTabSelector
                tabs={TABS}
                currentIndex={Math.max(0, activeTabIndex)}
                onSelect={(tab) => setActiveTab(tab.name)}
                className='w-full'
            />

            <div className='relative w-full'>
                <div className='flex gap-5 overflow-x-auto no-scrollbar p-1 pb-6'>

                    {visibleModes.map((mode) => {
                        const isSelected = mode.id === selectedModeId
                        const ModeIcon = mode.icon

                        return (
                            <button
                                key={mode.id}
                                type='button'
                                className='text-left max-w-80'
                                onClick={() => onSelectMode?.(mode.id)}
                            >
                                <Card
                                    hoverable
                                    className={`p-6! gap-4 border-2 min-h-72 outline-4
                                        ${isSelected ? 'border-neutral0 outline-neutral5' : 'border-neutral4 outline-none'}
                                    `}
                                >
                                    <div className='w-12 h-12 rounded-xl bg-neutral5 flex items-center justify-center'>
                                        <ModeIcon className='text-2xl text-neutral1' />
                                    </div>

                                    <p className='text-2xl font-semibold'>{mode.name}</p>
                                    <p className='text-sm text-neutral1 leading-relaxed'>{mode.description}</p>
                                </Card>
                            </button>
                        )
                    })}

                </div>

                <div className='absolute top-0 right-0 w-12 h-full bg-linear-to-l from-neutral6 to-transparent pointer-events-none' />
            </div>

        </div>
    )
}

export default GameModeModal