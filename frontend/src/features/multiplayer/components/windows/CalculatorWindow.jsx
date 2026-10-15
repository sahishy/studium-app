import Window from '../../../../shared/components/windows/Window'
import { getCenteredWindowPosition } from '../../../../shared/utils/windowDragUtils'
import { useMemo } from 'react'

const CALCULATOR_INITIAL_SIZE = { width: 780, height: 560 }

const CalculatorWindow = ({ isOpen, onClose }) => {

    const initialSize = useMemo(() => ({
        width: Math.min(CALCULATOR_INITIAL_SIZE.width, window.innerWidth - 24),
        height: Math.min(CALCULATOR_INITIAL_SIZE.height, window.innerHeight - 40),
    }), [isOpen])
    const resolvedInitialPosition = useMemo(() => {
        const centerPosition = getCenteredWindowPosition(initialSize)
        return {
            x: window.innerWidth < 800 ? centerPosition.x : centerPosition.x - initialSize.width / 3,
            y: centerPosition.y,
        }
    }, [initialSize])

    return (
        <Window
            isOpen={isOpen}
            onClose={onClose}
            title='Calculator'
            initialPosition={resolvedInitialPosition}
            initialSize={initialSize}
            minWidth={Math.min(520, initialSize.width)}
            minHeight={Math.min(380, initialSize.height)}
            contentClassName='p-0! h-full'
        >
            <iframe
                src='https://www.desmos.com/testing/collegeboard/graphing'
                aria-label='Desmos Graphing Calculator'
                className='w-full h-full border-0 rounded-b-xl'
                loading='lazy'
                referrerPolicy='strict-origin-when-cross-origin'
            />
        </Window>
    )
}

export default CalculatorWindow