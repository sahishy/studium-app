const clamp = (value, min, max) => {
    if(Number.isNaN(value)) {
        return min
    }

    return Math.min(Math.max(value, min), max)
}

const normalizeSize = (size = {}) => {
    return {
        width: Number(size.width) || 560,
        height: Number(size.height) || 360,
    }
}

const getViewportSize = () => {
    if(typeof window === 'undefined') {
        return { width: 0, height: 0 }
    }

    return {
        width: window.innerWidth,
        height: window.innerHeight,
    }
}

const getCenteredWindowPosition = (size = {}) => {
    const normalizedSize = normalizeSize(size)
    const viewport = getViewportSize()

    return {
        x: Math.max(16, (viewport.width - normalizedSize.width) / 2),
        y: Math.max(16, (viewport.height - normalizedSize.height) / 2),
    }
}

const getClampedWindowPosition = ({
    position = {},
    size = {},
    headerHeight = 52,
    viewportPadding = 12,
} = {}) => {
    const normalizedSize = normalizeSize(size)
    const viewport = getViewportSize()

    const minX = -(normalizedSize.width - headerHeight)
    const minY = 0
    const maxX = Math.max(viewportPadding, viewport.width - headerHeight)
    const maxY = Math.max(viewportPadding, viewport.height - headerHeight)

    return {
        x: clamp(position.x ?? 0, minX, maxX),
        y: clamp(position.y ?? 0, minY, maxY),
    }
}

export {
    normalizeSize,
    getCenteredWindowPosition,
    getClampedWindowPosition,
}