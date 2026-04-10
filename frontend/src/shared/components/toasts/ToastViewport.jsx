import { createPortal } from 'react-dom'
import BaseToast from './BaseToast'

const ToastViewport = ({ toasts, onRequestCloseToast }) => {
    if(typeof document === 'undefined') {
        return null
    }

    return createPortal(
        <div className='fixed top-4 left-1/2 -translate-x-1/2 z-[3000] pointer-events-none w-full px-4 flex flex-col items-center gap-3'>
            {toasts.map((toastEntry) => {
                const ToastComponent = toastEntry.component

                return (
                    <div key={toastEntry.id} className='pointer-events-auto'>
                        <BaseToast
                            isVisible={toastEntry.isVisible}
                            duration={toastEntry.duration}
                            canHide={toastEntry.duration != null}
                            onRequestClose={() => onRequestCloseToast?.(toastEntry.id)}
                        >
                            <ToastComponent {...toastEntry.props} />
                        </BaseToast>
                    </div>
                )
            })}
        </div>,
        document.body,
    )
}

export default ToastViewport
