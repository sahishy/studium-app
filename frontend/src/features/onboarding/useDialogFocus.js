import { useEffect } from 'react'
// Keep keyboard navigation inside onboarding dialogs; calculator windows are
// separate dialogs, so they can take focus until closed.
export default function useDialogFocus(ref, enabled) {
    useEffect(() => {
        if (!enabled || !ref.current) return
        const dialog=ref.current, previous=document.activeElement
        const selector='button:not([disabled]),a[href],input:not([disabled]),[tabindex="0"]'
        const first=dialog.querySelector('button[aria-pressed="true"]:not([disabled])') || dialog.querySelector(selector)
        first?.focus()
        const keydown=event=>{
            if(event.key!=='Tab')return
            if(document.activeElement?.closest('[role="dialog"]') !== dialog && !dialog.contains(document.activeElement))return
            const elements=[...dialog.querySelectorAll(selector)].filter(el=>el.getBoundingClientRect().width)
            if(!elements.length)return
            const index=elements.indexOf(document.activeElement)
            const next=(index+(event.shiftKey?-1:1)+elements.length)%elements.length
            event.preventDefault();elements[next].focus()
        }
        document.addEventListener('keydown',keydown)
        return()=>{document.removeEventListener('keydown',keydown);if(previous?.isConnected)previous.focus()}
    },[ref,enabled])
}
