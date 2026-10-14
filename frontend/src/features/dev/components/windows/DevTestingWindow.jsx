import { post } from '../../../../shared/services/apiService'
import { useState } from 'react'
import { FaArrowRotateLeft } from 'react-icons/fa6'
import { PiStarFourFill } from 'react-icons/pi'
import Window from '../../../../shared/components/windows/Window'
import Button from '../../../../shared/components/ui/Button'
import LumenIcon from '../../../economy/components/LumenIcon'
import { useEconomy } from '../../../economy/EconomyContext'
import { useRewardFx } from '../../../economy/RewardFxContext'
import { useQuests } from '../../../quests/QuestContext'

const WINDOW_SIZE = { width: 340, height: 390 }

// The grants and the quest ticks that used to be crammed into a strip in the Topbar. Development
// only: nothing here is wired up in a production build.
const DevTestingWindow = ({ isOpen, onClose }) => {

    const { grantTestReward, resetTestProgress } = useEconomy()
    const { celebrateReward } = useRewardFx()
    const { simulateQuestProgress } = useQuests()
    const [error, setError] = useState('')
    const [resetting, setResetting] = useState(false)
    const resetTutorials = async () => {
        setResetting(true); setError('')
        try {
            await post('/v1/dev/onboarding/reset')
            onClose()
            window.dispatchEvent(new Event('onboarding:reset'))
        } catch(err) { setError(err.message || 'Could not reset tutorials.') }
        finally { setResetting(false) }
    }

    const advanceQuest = async (slot) => {
        setError('')

        try {
            await simulateQuestProgress(slot)
        } catch(progressError) {
            setError(progressError?.message || 'Could not advance that quest.')
        }
    }

    return (
        <Window
            isOpen={isOpen}
            onClose={onClose}
            title='Testing'
            initialSize={WINDOW_SIZE}
            minWidth={300}
            minHeight={280}
        >
            <div className='flex flex-col gap-4'>

                <div className='flex flex-col gap-2'>
                    <p className='text-xs font-semibold text-neutral1'>Rewards</p>

                    <Button
                        onClick={() => { celebrateReward({ xp: 80 }); void grantTestReward({ xp: 80 }) }}
                        className='w-full text-yellow-400!'
                    >
                        <PiStarFourFill /> +80 XP
                    </Button>

                    <Button
                        onClick={() => { celebrateReward({ lumen: 60 }); void grantTestReward({ lumen: 60 }) }}
                        className='w-full text-sky-500!'
                    >
                        <LumenIcon className='size-3.5' /> +60 Lumen
                    </Button>

                    <Button onClick={() => void resetTestProgress()} className='w-full text-neutral1!'>
                        <FaArrowRotateLeft /> Reset progress
                    </Button>
                </div>

                <Button disabled={resetting} onClick={resetTutorials} className='w-full text-neutral1!'>
                    <FaArrowRotateLeft /> Reset tutorials
                </Button>

                <div className='flex flex-col gap-2'>
                    <p className='text-xs font-semibold text-neutral1'>Quest progress by slot</p>

                    <div className='flex items-center gap-2'>
                        {[0, 1, 2].map((slot) => (
                            <Button
                                key={slot}
                                onClick={() => void advanceQuest(slot)}
                                className='flex-1'
                                aria-description={`Advance the quest in slot ${slot + 1}`}
                            >
                                {slot + 1}
                            </Button>
                        ))}
                    </div>

                    {error ? <p role='alert' className='text-xs text-red-400'>{error}</p> : null}
                </div>

            </div>
        </Window>
    )
}

export default DevTestingWindow
