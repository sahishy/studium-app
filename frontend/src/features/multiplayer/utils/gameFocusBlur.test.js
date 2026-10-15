import assert from 'node:assert/strict'
import test from 'node:test'
import { subscribeToGameFocusBlur } from './gameFocusBlur.js'

const setup = ({ focused = true, hidden = false } = {}) => {
    const windowTarget = new EventTarget()
    const documentTarget = new EventTarget()
    const changes = []
    let poll
    let now = 0
    let timerId = 0
    const timeouts = new Map()
    documentTarget.hidden = hidden
    documentTarget.hasFocus = () => focused
    windowTarget.setInterval = (callback) => { poll = callback; return 1 }
    windowTarget.clearInterval = () => { poll = null }
    windowTarget.setTimeout = (callback, delay) => {
        const id = ++timerId
        timeouts.set(id, { callback, at: now + delay })
        return id
    }
    windowTarget.clearTimeout = (id) => timeouts.delete(id)
    const cleanup = subscribeToGameFocusBlur({ windowTarget, documentTarget, onChange: (value) => changes.push(value) })
    return {
        changes, cleanup, documentTarget, windowTarget,
        advance: (milliseconds) => {
            now += milliseconds
            for(const [id, timer] of timeouts) {
                if(timer.at <= now) {
                    timeouts.delete(id)
                    timer.callback()
                }
            }
        },
        setFocused: (value) => { focused = value },
        poll: () => poll?.(),
        emit: (target, type, properties = {}) => {
            const event = new Event(type)
            Object.assign(event, properties)
            target.dispatchEvent(event)
        },
    }
}

test('blurs immediately on window blur, even before hasFocus updates', () => {
    const state = setup()
    state.emit(state.windowTarget, 'blur')
    assert.deepEqual(state.changes, [false, true])
    state.setFocused(false)
    state.poll()
    assert.deepEqual(state.changes, [false, true])
    state.setFocused(true)
    state.emit(state.windowTarget, 'focus')
    assert.deepEqual(state.changes, [false, true, false])
    state.cleanup()
})

test('answer controls losing or gaining focus do not blur the match', () => {
    const state = setup()
    const answerControl = new EventTarget()
    for(const type of ['blur', 'focus']) {
        // Model a descendant event delivered to the window's capture listener.
        const event = new Event(type)
        Object.defineProperty(event, 'target', { value: answerControl })
        state.windowTarget.dispatchEvent(event)
    }
    state.poll()
    assert.deepEqual(state.changes, [false])
    state.cleanup()
})

test('element focus changes do not clear the Command + Shift blur', () => {
    const state = setup()
    state.emit(state.windowTarget, 'keydown', { key: 'Shift', metaKey: true, shiftKey: true })
    for(const type of ['blur', 'focus']) {
        const event = new Event(type)
        Object.defineProperty(event, 'target', { value: new EventTarget() })
        state.windowTarget.dispatchEvent(event)
    }
    assert.deepEqual(state.changes, [false, true])
    state.emit(state.windowTarget, 'keyup', { key: 'Shift', metaKey: true, shiftKey: false })
    state.advance(2000)
    assert.deepEqual(state.changes, [false, true, false])
    state.cleanup()
})

test('polling covers missed focus events without a tab visibility change', () => {
    const state = setup()
    state.setFocused(false)
    state.poll()
    assert.equal(state.changes.at(-1), true)
    state.setFocused(true)
    state.poll()
    assert.equal(state.changes.at(-1), false)
    state.cleanup()
})

test('initially hidden pages stay blurred until both visible and focused', () => {
    const state = setup({ hidden: true, focused: false })
    assert.deepEqual(state.changes, [true])
    state.documentTarget.hidden = false
    state.emit(state.documentTarget, 'visibilitychange')
    assert.deepEqual(state.changes, [true])
    state.setFocused(true)
    state.emit(state.windowTarget, 'focus')
    assert.deepEqual(state.changes, [true, false])
    state.cleanup()
})

test('leaving the page does not blur while the document still has focus', () => {
    const state = setup()
    state.emit(state.documentTarget, 'mouseleave')
    state.poll()
    assert.deepEqual(state.changes, [false])
    state.emit(state.documentTarget, 'mouseenter')
    assert.deepEqual(state.changes, [false])
    state.cleanup()
})

test('Command + Shift works in either press order and clears 2000ms after either modifier release', () => {
    for(const [first, second, released] of [
        [{ key: 'Meta', metaKey: true }, { key: 'Shift', metaKey: true, shiftKey: true }, { key: 'Shift', metaKey: true, shiftKey: false }],
        [{ key: 'Shift', shiftKey: true }, { key: 'Meta', metaKey: true, shiftKey: true }, { key: 'Meta', metaKey: false, shiftKey: true }],
    ]) {
        const state = setup()
        state.emit(state.windowTarget, 'keydown', first)
        assert.deepEqual(state.changes, [false])
        state.emit(state.windowTarget, 'keydown', second)
        state.emit(state.windowTarget, 'keydown', { key: '$', code: 'Digit4', metaKey: true, shiftKey: true })
        state.emit(state.windowTarget, 'keyup', { key: '$', code: 'Digit4', metaKey: true, shiftKey: true })
        state.poll()
        assert.deepEqual(state.changes, [false, true])
        state.emit(state.windowTarget, 'keyup', released)
        state.advance(1999)
        state.poll()
        assert.deepEqual(state.changes, [false, true])
        state.advance(1)
        assert.deepEqual(state.changes, [false, true, false])
        state.cleanup()
    }
})

test('ordinary typing does not blur and Command + Shift clears without a click', () => {
    const state = setup()
    state.emit(state.windowTarget, 'keydown', { key: 'a', code: 'KeyA' })
    assert.deepEqual(state.changes, [false])
    state.emit(state.windowTarget, 'keydown', { key: 'Shift', metaKey: true, shiftKey: true })
    state.emit(state.windowTarget, 'keydown', { key: 'R', code: 'KeyR', metaKey: true, shiftKey: true })
    assert.deepEqual(state.changes, [false, true])
    state.emit(state.windowTarget, 'keyup', { key: 'Shift', metaKey: true, shiftKey: false })
    state.advance(2000)
    assert.deepEqual(state.changes, [false, true, false])
    state.cleanup()
})

test('pointer movement restores the view after an OS-swallowed modifier release', () => {
    const state = setup()
    state.emit(state.windowTarget, 'keydown', { key: 'Shift', metaKey: true, shiftKey: true })
    state.emit(state.windowTarget, 'pointermove', { metaKey: false, shiftKey: false })
    state.advance(2000)
    assert.deepEqual(state.changes, [false, true, false])
    state.cleanup()
})

test('returning to the window clears modifiers released outside the page', () => {
    const state = setup()
    state.emit(state.windowTarget, 'keydown', { key: 'Shift', metaKey: true, shiftKey: true })
    state.setFocused(false)
    state.emit(state.windowTarget, 'blur')
    state.setFocused(true)
    state.emit(state.windowTarget, 'focus')
    assert.deepEqual(state.changes, [false, true])
    state.advance(2000)
    assert.deepEqual(state.changes, [false, true, false])
    state.cleanup()
})

test('releasing the screenshot chord does not unblur an unfocused window', () => {
    const state = setup()
    state.emit(state.windowTarget, 'keydown', { key: 'Shift', metaKey: true, shiftKey: true })
    state.setFocused(false)
    state.emit(state.windowTarget, 'keyup', { key: 'Shift', metaKey: true, shiftKey: false })
    state.advance(2000)
    assert.deepEqual(state.changes, [false, true])
    state.cleanup()
})

test('cleanup removes listeners and the fallback timer', () => {
    const state = setup()
    state.cleanup()
    state.emit(state.windowTarget, 'blur')
    state.emit(state.documentTarget, 'mouseleave')
    state.setFocused(false)
    state.poll()
    assert.deepEqual(state.changes, [false])
})

test('Windows + Shift + S keeps the blur for 2000ms after release', () => {
    for(const windowsKey of ['Meta', 'OS']) {
        const state = setup()
        state.emit(state.windowTarget, 'keydown', { key: windowsKey, metaKey: true })
        state.emit(state.windowTarget, 'keydown', { key: 'Shift', metaKey: true, shiftKey: true })
        state.emit(state.windowTarget, 'keydown', { key: 'S', code: 'KeyS', metaKey: true, shiftKey: true })
        state.emit(state.windowTarget, 'keyup', { key: windowsKey, metaKey: false, shiftKey: true })
        state.advance(1999)
        assert.deepEqual(state.changes, [false, true])
        state.advance(1)
        assert.deepEqual(state.changes, [false, true, false])
        state.cleanup()
    }
})

test('pointer movement and polling do not shorten or extend the cooldown', () => {
    const state = setup()
    state.emit(state.windowTarget, 'keydown', { key: 'Shift', metaKey: true, shiftKey: true })
    state.emit(state.windowTarget, 'keyup', { key: 'Shift', metaKey: true, shiftKey: false })
    state.advance(1000)
    state.emit(state.windowTarget, 'pointermove', { metaKey: false, shiftKey: false })
    state.poll()
    assert.deepEqual(state.changes, [false, true])
    state.advance(1000)
    assert.deepEqual(state.changes, [false, true, false])
    state.cleanup()
})

test('pressing the shortcut again starts a fresh cooldown after its release', () => {
    const state = setup()
    const press = () => state.emit(state.windowTarget, 'keydown', { key: 'Shift', metaKey: true, shiftKey: true })
    const release = () => state.emit(state.windowTarget, 'keyup', { key: 'Shift', metaKey: true, shiftKey: false })
    press()
    release()
    state.advance(1900)
    press()
    state.advance(200)
    assert.deepEqual(state.changes, [false, true])
    release()
    state.advance(1999)
    assert.deepEqual(state.changes, [false, true])
    state.advance(1)
    assert.deepEqual(state.changes, [false, true, false])
    state.cleanup()
})

test('unmounting cancels a pending cooldown', () => {
    const state = setup()
    state.emit(state.windowTarget, 'keydown', { key: 'Shift', metaKey: true, shiftKey: true })
    state.emit(state.windowTarget, 'keyup', { key: 'Shift', metaKey: true, shiftKey: false })
    state.cleanup()
    state.advance(2000)
    assert.deepEqual(state.changes, [false, true])
})

test('quick taps stay blurred for two seconds even when keydown is swallowed', () => {
    for(const release of [
        { key: 'Shift', metaKey: true, shiftKey: false },
        { key: 'Meta', metaKey: false, shiftKey: true },
        { key: 'OS', metaKey: false, shiftKey: true },
        { key: 'PrintScreen' },
    ]) {
        const state = setup()
        state.emit(state.windowTarget, 'keyup', release)
        assert.deepEqual(state.changes, [false, true])
        state.advance(500)
        state.emit(state.windowTarget, 'pointermove', { metaKey: false, shiftKey: false })
        state.poll()
        assert.deepEqual(state.changes, [false, true])
        state.advance(1499)
        assert.deepEqual(state.changes, [false, true])
        state.advance(1)
        assert.deepEqual(state.changes, [false, true, false])
        state.cleanup()
    }
})

test('releasing a single modifier without a screenshot chord does not blur', () => {
    const state = setup()
    state.emit(state.windowTarget, 'keyup', { key: 'Shift', metaKey: false, shiftKey: false })
    state.emit(state.windowTarget, 'keyup', { key: 'Meta', metaKey: false, shiftKey: false })
    assert.deepEqual(state.changes, [false])
    state.cleanup()
})
