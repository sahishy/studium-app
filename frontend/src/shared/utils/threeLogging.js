import { getConsoleFunction, setConsoleFunction } from 'three'

// Fiber 9 creates a Clock for each Canvas. Keep this compatibility warning quiet
// until Fiber migrates to Timer: https://github.com/pmndrs/react-three-fiber/issues/3741
// Scope the filter to Three's logger so other warnings (including deprecations)
// and the browser console remain available.
const clockDeprecation = 'THREE.THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.'
const previousLogger = getConsoleFunction()

setConsoleFunction((type, message, ...params) => {
    if (type === 'warn' && message === clockDeprecation) return
    if (previousLogger) {
        previousLogger(type, message, ...params)
    } else {
        console[type](message, ...params)
    }
})

if (import.meta.hot) {
    import.meta.hot.dispose(() => setConsoleFunction(previousLogger))
}
