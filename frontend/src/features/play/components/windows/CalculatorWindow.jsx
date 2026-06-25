import Window from '../../../../shared/components/windows/Window'
import { getCenteredWindowPosition } from '../../../../shared/utils/windowDragUtils'
import { useMemo } from 'react'

const CALCULATOR_INITIAL_SIZE = { width: 780, height: 560 }

const CalculatorWindow = ({ isOpen, onClose }) => {

    const resolvedInitialPosition = useMemo(() => {
        const centerPosition = getCenteredWindowPosition(CALCULATOR_INITIAL_SIZE)
        return {
            x: centerPosition.x - CALCULATOR_INITIAL_SIZE.width / 3,
            y: centerPosition.y,
        }
    }, [])

    return (
        <Window
            isOpen={isOpen}
            onClose={onClose}
            title='Calculator'
            initialPosition={resolvedInitialPosition}
            initialSize={CALCULATOR_INITIAL_SIZE}
            minWidth={520}
            minHeight={380}
            contentClassName='p-0! h-full'
        >
            <iframe
                src='https://www.desmos.com/testing/collegeboard/graphing'
                title='Desmos Graphing Calculator'
                className='w-full h-full border-0 rounded-b-xl'
                loading='lazy'
                referrerPolicy='strict-origin-when-cross-origin'
            />
        </Window>
    )
}

export default CalculatorWindow