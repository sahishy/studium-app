import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import ToastViewport from '../components/toasts/ToastViewport'

const EXIT_ANIMATION_MS = 250

const ToastContext = createContext()

export const useToast = () => useContext(ToastContext)

export const ToastProvider = ({ children }) => {

    const [toastStack, setToastStack] = useState([])
    const toastStackRef = useRef([])
    const autoDismissTimersRef = useRef(new Map())
    const removeTimersRef = useRef(new Map())

    useEffect(() => {
        toastStackRef.current = toastStack
    }, [toastStack])

    const clearTimer = (timerMap, toastId) => {
        const timer = timerMap.get(toastId)
        if(timer) {
            clearTimeout(timer)
            timerMap.delete(toastId)
        }
    }

    const hideToast = useCallback((toastId, options = {}) => {
        if(!toastId) {
            return
        }

        const { force = false } = options

        const targetToast = toastStackRef.current.find((toastEntry) => toastEntry.id === toastId)
        if(!targetToast) {
            return
        }

        if(!targetToast.isVisible) {
            return
        }

        if(targetToast?.duration == null && !force) {
            return
        }

        setToastStack((previous) => previous.map((toastEntry) => (
            toastEntry.id === toastId
                ? { ...toastEntry, isVisible: false }
                : toastEntry
        )))

        clearTimer(autoDismissTimersRef.current, toastId)
        clearTimer(removeTimersRef.current, toastId)

        const removeTimer = setTimeout(() => {
            setToastStack((previous) => previous.filter((toastEntry) => toastEntry.id !== toastId))
            removeTimersRef.current.delete(toastId)
        }, EXIT_ANIMATION_MS)

        removeTimersRef.current.set(toastId, removeTimer)
    }, [])

    const showToast = useCallback(({
        component,
        props = {},
        duration = 3000,
    }) => {

        if(!component) {
            return null
        }

        const toastId = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

        setToastStack((previous) => [
            ...previous,
            {
                id: toastId,
                component,
                props,
                duration,
                isVisible: true,
            },
        ])

        if(duration != null) {
            const autoDismissTimer = setTimeout(() => {
                hideToast(toastId)
            }, duration)

            autoDismissTimersRef.current.set(toastId, autoDismissTimer)
        }

        return toastId

    }, [hideToast])

    const updateToast = useCallback((toastId, updates = {}) => {
        if(!toastId) {
            return
        }

        setToastStack((previous) => previous.map((toastEntry) => {
            if(toastEntry.id !== toastId) {
                return toastEntry
            }

            return {
                ...toastEntry,
                ...updates,
                props: {
                    ...toastEntry.props,
                    ...(updates.props ?? {}),
                },
            }
        }))

        if(Object.prototype.hasOwnProperty.call(updates, 'duration')) {
            clearTimer(autoDismissTimersRef.current, toastId)

            if(updates.duration != null) {
                const autoDismissTimer = setTimeout(() => {
                    hideToast(toastId)
                }, updates.duration)

                autoDismissTimersRef.current.set(toastId, autoDismissTimer)
            }
        }
    }, [hideToast])

    const clearToasts = useCallback(() => {
        Array.from(autoDismissTimersRef.current.keys()).forEach((toastId) => {
            clearTimer(autoDismissTimersRef.current, toastId)
        })

        Array.from(removeTimersRef.current.keys()).forEach((toastId) => {
            clearTimer(removeTimersRef.current, toastId)
        })

        setToastStack([])
    }, [])

    useEffect(() => {
        return () => {
            Array.from(autoDismissTimersRef.current.keys()).forEach((toastId) => {
                clearTimer(autoDismissTimersRef.current, toastId)
            })

            Array.from(removeTimersRef.current.keys()).forEach((toastId) => {
                clearTimer(removeTimersRef.current, toastId)
            })
        }
    }, [])

    return (
        <ToastContext.Provider value={{ toastStack, showToast, hideToast, updateToast, clearToasts }}>
            {children}
            <ToastViewport toasts={toastStack} onRequestCloseToast={hideToast} />
        </ToastContext.Provider>
    )
    
}
