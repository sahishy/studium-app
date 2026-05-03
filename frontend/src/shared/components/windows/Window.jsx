import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FaGrip } from 'react-icons/fa6'
import CloseButton from '../ui/CloseButton'
import { allocateWindowLayer, getWindowRoot, isTopWindowLayer, releaseWindowLayer, subscribeWindowLayerChanges } from '../../utils/windowLayerUtils'
import { getCenteredWindowPosition, getClampedWindowPosition, normalizeSize } from '../../utils/windowDragUtils'

const Window = ({ isOpen,  onClose, title = 'Window', children, initialPosition, initialSize, minWidth = 360, minHeight = 220, className = '',contentClassName = '' }) => {

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
        setPosition(getClampedWindowPosition({ position: resolvedInitialPosition, size: initialSize }))
    }, [isOpen, initialSize, resolvedInitialPosition])

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

            setWindowSize(measuredSize)
            setPosition((currentPosition) => getClampedWindowPosition({
                position: currentPosition,
                size: measuredSize,
            }))
        }

        updateMeasuredSize()
        window.addEventListener('resize', updateMeasuredSize)

        return () => {
            window.removeEventListener('resize', updateMeasuredSize)
        }
    }, [isOpen])

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
            if(!dragStateRef.current.isDragging) {
                return
            }

            const deltaX = event.clientX - dragStateRef.current.pointerStartX
            const deltaY = event.clientY - dragStateRef.current.pointerStartY

            const nextPosition = {
                x: dragStateRef.current.windowStartX + deltaX,
                y: dragStateRef.current.windowStartY + deltaY,
            }

            setPosition(getClampedWindowPosition({ position: nextPosition, size: windowSize }))
        }

        const handlePointerUp = () => {
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
    }, [isOpen, windowSize])

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

        bringToFront()
        dragStateRef.current = {
            isDragging: true,
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
        <div className='fixed inset-0 pointer-events-none' style={{ zIndex }}>
            <div
                ref={windowRef}
                role='dialog'
                aria-modal='false'
                tabIndex={-1}
                className={`pointer-events-auto absolute bg-neutral6 rounded-xl border border-neutral4 shadow-2xl shadow-neutral0/10 overflow-hidden ${className}`}
                style={{
                    width: initialSize?.width,
                    height: initialSize?.height,
                    minWidth,
                    minHeight,
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
                            onPointerDown={handleDragStart}
                            className='text-neutral1 transition-colors cursor-grab active:cursor-grabbing hover:text-neutral0 select-none'
                        >
                            <FaGrip className='text-sm'/>
                        </button>

                        <div className='justify-self-end'>
                            <CloseButton onClick={onClose} className='p-1! text-sm!'/>
                        </div>
                    </div>
                </div>

                <div className={`p-4 ${contentClassName}`}>
                    {children}
                </div>
            </div>
        </div>,
        windowRoot
    )

}

export default Window