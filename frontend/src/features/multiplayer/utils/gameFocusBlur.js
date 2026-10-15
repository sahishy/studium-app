const SCREENSHOT_COOLDOWN_MS = 2000

export const subscribeToGameFocusBlur = ({ windowTarget, documentTarget, onChange }) => {
    let screenshotKeysHeld = false
    let screenshotCooldown = false
    let cooldownTimer = null
    let lastBlurred
    const isOutOfFocus = () => documentTarget.hidden || !documentTarget.hasFocus()
    const update = (forceBlur = false) => {
        const blurred = forceBlur || screenshotKeysHeld || screenshotCooldown || isOutOfFocus()
        if(blurred !== lastBlurred) {
            lastBlurred = blurred
            onChange(blurred)
        }
    }
    const setScreenshotKeysHeld = (held) => {
        if(held === screenshotKeysHeld) return
        screenshotKeysHeld = held
        windowTarget.clearTimeout(cooldownTimer)
        cooldownTimer = null
        screenshotCooldown = !held
        if(!held) {
            // Keep capture UI covered briefly after the OS consumes the shortcut.
            cooldownTimer = windowTarget.setTimeout(() => {
                cooldownTimer = null
                screenshotCooldown = false
                update()
            }, SCREENSHOT_COOLDOWN_MS)
        }
    }
    const onBlur = (event) => {
        // Capture listeners also see inputs/buttons blur when disabled or removed.
        // Only the window itself losing focus should obscure the match.
        if(event.target !== windowTarget) return
        // Key releases may go to another app once focus leaves the page.
        setScreenshotKeysHeld(false)
        update(true)
    }
    const syncFocus = () => {
        if(isOutOfFocus()) setScreenshotKeysHeld(false)
        update()
    }
    const onFocus = (event) => {
        if(event.target !== windowTarget) return
        setScreenshotKeysHeld(false)
        update()
    }
    const syncModifiers = (event) => {
        // Meta covers Command on macOS and Windows on Windows (Win + Shift + S).
        // Arm before the OS consumes the shortcut's final key.
        const metaModifier = event.metaKey || event.getModifierState?.('OS')
        const metaHeld = metaModifier
            && !(event.type === 'keyup' && ['Meta', 'OS'].includes(event.key))
        const shiftHeld = event.shiftKey && !(event.type === 'keyup' && event.key === 'Shift')
        // A quick OS shortcut may deliver only keyup. Releasing either modifier
        // while the other is held is enough evidence to start the cooldown.
        const releasedScreenshotKeys = event.type === 'keyup' && (
            (event.key === 'Shift' && metaModifier)
            || (['Meta', 'OS'].includes(event.key) && event.shiftKey)
            || event.key === 'PrintScreen'
        )
        if(releasedScreenshotKeys) setScreenshotKeysHeld(true)
        setScreenshotKeysHeld(Boolean((metaHeld && shiftHeld)
            || (event.type === 'keydown' && event.key === 'PrintScreen')))
        update()
    }

    const listeners = [
        [windowTarget, 'blur', onBlur],
        [windowTarget, 'focus', onFocus],
        [documentTarget, 'visibilitychange', syncFocus],
        [windowTarget, 'keydown', syncModifiers],
        [windowTarget, 'keyup', syncModifiers],
        // Recover automatically if the OS swallowed keyup while opening capture UI.
        [windowTarget, 'pointermove', syncModifiers],
    ]
    const listenerOptions = { capture: true }
    listeners.forEach(([target, event, handler]) => target.addEventListener(event, handler, listenerOptions))
    // Some browser/OS combinations miss focus events when an external overlay opens.
    const timer = windowTarget.setInterval(syncFocus, 200)
    update()

    return () => {
        listeners.forEach(([target, event, handler]) => target.removeEventListener(event, handler, listenerOptions))
        windowTarget.clearInterval(timer)
        windowTarget.clearTimeout(cooldownTimer)
    }
}
