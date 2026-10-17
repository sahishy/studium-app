export const fitMobileWindowSize = ({ size, minWidth, minHeight, viewport }) => ({
    width: Math.min(Math.max(size.width, minWidth), Math.max(1, viewport.width - 16)),
    height: Math.min(Math.max(size.height, minHeight), Math.max(1, viewport.height - 16)),
})

// Controls are measured relative to the dialog, independent of its current translation.
export const clampMobileWindowPosition = ({ position, viewport, controls }) => {
    const minX = viewport.left - controls.left
    const maxX = viewport.left + viewport.width - controls.right
    const minY = viewport.top
    const maxY = Math.max(minY, viewport.top + viewport.height - controls.bottom)
    return {
        x: Math.max(minX, Math.min(maxX, position.x)),
        y: Math.max(minY, Math.min(maxY, position.y)),
    }
}
