import { MAX_IMAGE_BYTES } from './feedbackService.js'

const toBlob = (canvas, type, quality) => new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not create your screenshot.')), type, quality)
})

export const capturePageScreenshot = async () => {
    const { default: html2canvas } = await import('html2canvas-pro')
    await document.fonts.ready
    const width = window.innerWidth
    const height = window.innerHeight
    const canvas = await html2canvas(document.documentElement, {
        width,
        height,
        x: window.scrollX,
        y: window.scrollY,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        windowWidth: width,
        windowHeight: height,
        scale: Math.min(window.devicePixelRatio || 1, 1.5, 2400 / Math.max(width, height)),
        useCORS: true,
        logging: false,
        // Keep the feedback modal, capture controls, and tooltips out of the image.
        ignoreElements: (element) => element.id === 'modal-root'
            || element.hasAttribute('data-feedback-capture-ignore')
            || element.getAttribute('role') === 'tooltip',
    })
    let blob = await toBlob(canvas, 'image/png')
    if (blob.size > MAX_IMAGE_BYTES) blob = await toBlob(canvas, 'image/jpeg', 0.85)
    if (blob.size > MAX_IMAGE_BYTES) throw new Error('This screenshot is too large. Please attach a smaller image instead.')
    const extension = blob.type === 'image/png' ? 'png' : 'jpg'
    return new File([blob], `screenshot.${extension}`, { type: blob.type })
}
