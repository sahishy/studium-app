let windowLayerSeed = 0
let bodyScrollLockCount = 0
let previousBodyOverflow = ''
const activeWindowLayers = new Set()
const layerSubscribers = new Set()

const notifyLayerSubscribers = () => {
    layerSubscribers.forEach((callback) => callback())
}

const getWindowRoot = () => {
    if(typeof document === 'undefined') {
        return null
    }

    return document.getElementById('modal-root')
}

const allocateWindowLayer = () => {
    windowLayerSeed += 1
    activeWindowLayers.add(windowLayerSeed)
    notifyLayerSubscribers()
    return windowLayerSeed
}

const releaseWindowLayer = (layerId) => {
    if(layerId == null) {
        return
    }

    activeWindowLayers.delete(layerId)

    if(activeWindowLayers.size === 0) {
        windowLayerSeed = 0
    }

    notifyLayerSubscribers()
}

const getTopWindowLayer = () => {
    if(activeWindowLayers.size === 0) {
        return null
    }

    return Math.max(...activeWindowLayers)
}

const isTopWindowLayer = (layerId) => {
    if(layerId == null) {
        return false
    }

    const topLayerId = getTopWindowLayer()
    return topLayerId === layerId
}

const subscribeWindowLayerChanges = (callback) => {
    if(typeof callback !== 'function') {
        return () => {}
    }

    layerSubscribers.add(callback)
    return () => {
        layerSubscribers.delete(callback)
    }
}

const lockBodyScroll = () => {
    if(typeof document === 'undefined') {
        return
    }

    if(bodyScrollLockCount === 0) {
        previousBodyOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
    }

    bodyScrollLockCount += 1
}

const unlockBodyScroll = () => {
    if(typeof document === 'undefined') {
        return
    }

    bodyScrollLockCount = Math.max(0, bodyScrollLockCount - 1)

    if(bodyScrollLockCount === 0) {
        document.body.style.overflow = previousBodyOverflow
    }
}

export {
    getWindowRoot,
    allocateWindowLayer,
    releaseWindowLayer,
    isTopWindowLayer,
    subscribeWindowLayerChanges,
    lockBodyScroll,
    unlockBodyScroll,
}