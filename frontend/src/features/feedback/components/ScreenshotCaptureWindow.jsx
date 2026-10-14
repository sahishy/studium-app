import { useEffect, useRef, useState } from 'react'
import { FaCamera, FaCircleNotch } from 'react-icons/fa6'
import Window from '../../../shared/components/windows/Window.jsx'
import TextTooltip from '../../../shared/components/tooltips/TextTooltip.jsx'
import { capturePageScreenshot } from '../services/screenshotService.js'

const WINDOW_SIZE = { width: 220, height: 104 }

const ScreenshotCaptureWindow = ({ onCapture, onClose }) => {
    const [capturing, setCapturing] = useState(false)
    const [error, setError] = useState('')
    const mountedRef = useRef(true)
    const capturingRef = useRef(false)

    useEffect(() => {
        mountedRef.current = true
        return () => { mountedRef.current = false }
    }, [])

    const capture = async () => {
        if (capturingRef.current) return
        capturingRef.current = true
        setCapturing(true)
        setError('')
        try {
            const file = await capturePageScreenshot()
            if (mountedRef.current) onCapture(file)
        } catch (captureError) {
            if (mountedRef.current) setError(captureError.message || 'Could not capture this page. Please try again.')
        } finally {
            if (mountedRef.current) setCapturing(false)
            capturingRef.current = false
        }
    }

    return (
        <Window isOpen onClose={onClose} title='Screenshot' initialSize={WINDOW_SIZE} minWidth={200} minHeight={error ? 172 : 104} contentClassName='p-2!'>
            <div data-feedback-capture-ignore className='flex flex-col items-center gap-2'>
                <TextTooltip text='Capture page' placement='bottom' disabled={capturing}>
                    <button
                        type='button'
                        onClick={capture}
                        disabled={capturing}
                        aria-label={capturing ? 'Capturing screenshot' : 'Capture page'}
                        className='size-10 flex items-center justify-center rounded-full text-neutral1 hover:text-neutral0 transition-colors cursor-pointer disabled:cursor-wait'
                    >
                        {capturing ? <FaCircleNotch className='animate-spin' /> : <FaCamera />}
                    </button>
                </TextTooltip>
                {error && <p role='alert' className='text-xs text-red-400 text-center'>{error}</p>}
            </div>
        </Window>
    )
}

export default ScreenshotCaptureWindow
