import useMobileView from '../../utils/useMobileView'
import useVisualViewport from '../../utils/useVisualViewport'
import { clampMobileWindowPosition, fitMobileWindowSize } from '../../utils/mobileWindowUtils'
import './Window.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FaGrip } from 'react-icons/fa6'
import CloseButton from '../ui/CloseButton'
import { allocateWindowLayer, getWindowRoot, isTopWindowLayer, releaseWindowLayer, subscribeWindowLayerChanges } from '../../utils/windowLayerUtils'
import { getCenteredWindowPosition, getClampedWindowPosition, normalizeSize } from '../../utils/windowDragUtils'

const Window = ({ isOpen,  onClose, title = 'Window', children, initialPosition, initialSize, minWidth = 360, minHeight = 220, className = '',contentClassName = '' }) => {

    const mobile = useMobileView()
    const viewport = useVisualViewport()
    const dragHandleRef = useRef(null)
    const closeRef = useRef(null)
    const mobileSize = fitMobileWindowSize({ size: normalizeSize(initialSize), minWidth, minHeight, viewport })
    const windowRoot = getWindowRoot()
    const windowRef = useRef(null)
    const layerRef = useRef(null)
    const hasInitializedOpenStateRef = useRef(false)
    const dragStateRef = useRef({
        isDragging: false,
        pointerStartX: 0,
        pointerStartY: 0,
        windowStartX: 0,
        windowStartY: 0,
    })

    const [windowLayer, setWindowLayer] = useState(null)
    const [isTopmostLayer, setIsTopmostLayer] = useState(true)
    const [windowSize, setWindowSize] = useState(() => normalizeSize(initialSize))
    const [position, setPosition] = useState({ x: 0, y: 0 })

    const clampPosition = useCallback((nextPosition, size) => {
        const dialog = windowRef.current
        const handle = dragHandleRef.current
        const close = closeRef.current
        if(!mobile || !dialog || !handle || !close) return getClampedWindowPosition({ position: nextPosition, size })
        const bounds = dialog.getBoundingClientRect()
        const grip = handle.getBoundingClientRect()
        const dismiss = close.getBoundingClientRect()
        return clampMobileWindowPosition({ position: nextPosition, viewport, controls: {
            left: Math.min(grip.left, dismiss.left) - bounds.left,
            right: Math.max(grip.right, dismiss.right) - bounds.left,
            bottom: Math.max(grip.bottom, dismiss.bottom) - bounds.top,
        } })
    }, [mobile, viewport])

    const resolvedInitialPosition = useMemo(() => {
        const fallbackPosition = getCenteredWindowPosition(initialSize)

        if(initialPosition?.x == null || initialPosition?.y == null) {
            return fallbackPosition
        }

        return {
            x: initialPosition.x,
            y: initialPosition.y,
        }
    }, [initialPosition, initialSize])

    useEffect(() => {
        if(!isOpen) {
            return
        }

        const nextLayer = allocateWindowLayer()
        layerRef.current = nextLayer
        setWindowLayer(nextLayer)
        setIsTopmostLayer(isTopWindowLayer(nextLayer))

        const unsubLayers = subscribeWindowLayerChanges(() => {
            setIsTopmostLayer(isTopWindowLayer(layerRef.current))
        })

        return () => {
            unsubLayers()

            if(layerRef.current != null) {
                releaseWindowLayer(layerRef.current)
            }

            layerRef.current = null
            setWindowLayer(null)
        }
    }, [isOpen])

    useEffect(() => {
        if(!isOpen) {
            hasInitializedOpenStateRef.current = false
            return
        }

        if(hasInitializedOpenStateRef.current) {
            return
        }

        hasInitializedOpenStateRef.current = true

        setWindowSize(normalizeSize(initialSize))
        setPosition(clampPosition(mobile ? { x: viewport.left + (viewport.width - mobileSize.width) / 2, y: viewport.top + (viewport.height - mobileSize.height) / 2 } : resolvedInitialPosition, initialSize))
    }, [isOpen, initialSize, resolvedInitialPosition, clampPosition, mobile, viewport, mobileSize.width, mobileSize.height])

    useEffect(() => {
        if(!isOpen || !windowRef.current) {
            return
        }

        const updateMeasuredSize = () => {
            const element = windowRef.current

            if(!element) {
                return
            }

            const measuredSize = {
                width: element.offsetWidth,
                height: element.offsetHeight,
            }

            setWindowSize((previous) => previous.width === measuredSize.width && previous.height === measuredSize.height ? previous : measuredSize)
            setPosition((currentPosition) => {
                const resizePosition = mobile ? { ...currentPosition, y: Math.min(currentPosition.y, viewport.top + viewport.height - measuredSize.height) } : currentPosition
                const next = clampPosition(resizePosition, measuredSize)
                return next.x === currentPosition.x && next.y === currentPosition.y ? currentPosition : next
            })
        }

        updateMeasuredSize()
        const observer = new ResizeObserver(updateMeasuredSize)
        observer.observe(windowRef.current)
        window.addEventListener('resize', updateMeasuredSize)

        return () => {
            observer.disconnect()
            window.removeEventListener('resize', updateMeasuredSize)
        }
    }, [isOpen, clampPosition, mobile, viewport])

    useEffect(() => {
        if(!isOpen) {
            return
        }

        const handleKeyDown = (event) => {
            if(event.key === 'Escape' && isTopmostLayer) {
                onClose?.()
            }
        }

        document.addEventListener('keydown', handleKeyDown)

        return () => {
            document.removeEventListener('keydown', handleKeyDown)
        }
    }, [isOpen, onClose, isTopmostLayer])

    useEffect(() => {
        if(!isOpen) {
            return
        }

        const handlePointerMove = (event) => {
            if(!dragStateRef.current.isDragging || dragStateRef.current.pointerId !== event.pointerId) {
                return
            }

            const deltaX = event.clientX - dragStateRef.current.pointerStartX
            const deltaY = event.clientY - dragStateRef.current.pointerStartY

            const nextPosition = {
                x: dragStateRef.current.windowStartX + deltaX,
                y: dragStateRef.current.windowStartY + deltaY,
            }

            setPosition(clampPosition(nextPosition, windowSize))
        }

        const handlePointerUp = (event) => {
            if(dragStateRef.current.pointerId !== event.pointerId) return
            dragStateRef.current.isDragging = false
            document.body.style.userSelect = ''
        }

        document.addEventListener('pointermove', handlePointerMove)
        document.addEventListener('pointerup', handlePointerUp)
        document.addEventListener('pointercancel', handlePointerUp)

        return () => {
            document.removeEventListener('pointermove', handlePointerMove)
            document.removeEventListener('pointerup', handlePointerUp)
            document.removeEventListener('pointercancel', handlePointerUp)
            document.body.style.userSelect = ''
        }
    }, [isOpen, windowSize, clampPosition])

    const bringToFront = () => {
        const currentLayer = layerRef.current

        if(currentLayer == null || isTopWindowLayer(currentLayer)) {
            return
        }

        const nextLayer = allocateWindowLayer()
        layerRef.current = nextLayer
        setWindowLayer(nextLayer)
        setIsTopmostLayer(true)
        releaseWindowLayer(currentLayer)
    }

    const handleDragStart = (event) => {
        if(event.button !== 0) {
            return
        }

        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        bringToFront()
        dragStateRef.current = {
            isDragging: true,
            pointerId: event.pointerId,
            pointerStartX: event.clientX,
            pointerStartY: event.clientY,
            windowStartX: position.x,
            windowStartY: position.y,
        }

        document.body.style.userSelect = 'none'
    }

    if(!isOpen || !windowRoot) {
        return null
    }

    const zIndex = 1000 + ((windowLayer ?? 1) * 10)

    return createPortal(
        <div className={`fixed inset-0 pointer-events-none ${mobile ? 'overflow-hidden' : ''}`} style={{ zIndex }}>
            <div
                ref={windowRef}
                role='dialog'
                aria-modal='false'
                tabIndex={-1}
                className={`floating-window ${mobile ? 'mobile-floating-window' : ''} pointer-events-auto absolute bg-neutral6 rounded-xl border border-neutral4 shadow-2xl shadow-neutral0/10 overflow-hidden ${className}`}
                style={{
                    width: mobile ? mobileSize.width : initialSize?.width,
                    height: mobile ? mobileSize.height : initialSize?.height,
                    minWidth: mobile ? Math.min(minWidth, mobileSize.width) : minWidth,
                    minHeight: mobile ? Math.min(minHeight, mobileSize.height) : minHeight,
                    transform: `translate(${position.x}px, ${position.y}px)`,
                }}
                onPointerDown={bringToFront}
            >
                <div className='p-2 border-b border-neutral4 bg-neutral6/80'>
                    <div className='grid grid-cols-[1fr_auto_1fr] items-center gap-3'>
                        <h3 className='text-xs font-semibold text-neutral0 truncate'>{title}</h3>

                        <button
                            type='button'
                            aria-label='Drag window'
                            ref={dragHandleRef}
                            onPointerDown={handleDragStart}
                            onLostPointerCapture={() => { dragStateRef.current.isDragging = false; document.body.style.userSelect = '' }}
                            className='window-drag-handle text-neutral1 transition-colors cursor-grab active:cursor-grabbing hover:text-neutral0 select-none'
                        >
                            <FaGrip className='text-sm'/>
                        </button>

                        <div ref={closeRef} className='window-close justify-self-end'>
                            <CloseButton onClick={onClose} className='p-1! text-sm!'/>
                        </div>
                    </div>
                </div>

                <div className={`window-content p-4 ${contentClassName}`}>
                    {children}
                </div>
            </div>
        </div>,
        windowRoot
    )

}

export default Window