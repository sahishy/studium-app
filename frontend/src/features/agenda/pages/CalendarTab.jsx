import { useState } from 'react'
import Button from '../../../shared/components/ui/Button'
import CalculatorWindow from '../../multiplayer/components/windows/CalculatorWindow'

const CalendarTab = () => {

    const [test, setTest] = useState(false)

    return (
        <div className='w-full flex flex-col gap-4'>

            <div className='flex items-center gap-3'>
                <Button
                    onClick={() => setTest((previous) => !previous)}
                >
                    {test ? 'Hide Test Window' : 'Show Test Window'}
                </Button>
            </div>

            <h1 className='text-text2'>Coming soon!</h1>

            <CalculatorWindow
                isOpen={test}
                onClose={() => setTest(false)}
            />

        </div>
    )
}


export default CalendarTab