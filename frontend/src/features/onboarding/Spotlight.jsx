import { useEffect, useRef, useState } from 'react'
import { IoMdInformationCircleOutline } from 'react-icons/io'
import { BsHandIndexThumbFill } from 'react-icons/bs'
import Button from '../../shared/components/ui/Button'
import useFadeIn from './useFadeIn'
const selector=target=>`[data-onboarding="${CSS.escape(target)}"]`
const stepKey=step=>step?JSON.stringify([step.id,step.target,step.route,step.recordId,step.kind,step.event,step.text,step.allowInteraction]):null
export default function Spotlight({step:incomingStep,busy,error,onNext,onRetry,visible:requestedVisible=true}){
    const [step,setStep]=useState(incomingStep)
    const incomingRef=useRef(incomingStep)
    if(incomingStep)incomingRef.current=incomingStep
    const entered=useFadeIn()
    const incomingKey=stepKey(incomingStep || step),changing=stepKey(step)!==incomingKey
    const visible=entered && !!incomingStep && requestedVisible && !changing
    const targetInteractive=step?.kind!=='info' || step?.allowInteraction===true
    const visibleRef=useRef(visible)
    visibleRef.current=visible
    useEffect(()=>{
        if(!changing)return
        // transitionend normally commits the next step. The fallback also covers
        // already-hidden overlays and browsers that do not emit a transition event.
        const delay=window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:534
        const timer=setTimeout(()=>setStep(incomingRef.current),delay)
        return()=>clearTimeout(timer)
    },[changing,incomingKey])
    const cardRef=useRef(null), targetRef=useRef(null)
    const [rect,setRect]=useState(null),[missing,setMissing]=useState(false)
    useEffect(()=>{
        // Preserve the outgoing hole, copy, and position throughout its fade.
        if(!visible)return
        let timer,scrolled=false
        const measure=()=>{
            if(!visibleRef.current)return
            let target=step.target
            const modal=[...document.querySelectorAll('[role="dialog"]')].find(n=>n.getAttribute('aria-label')!=='Tutorial guidance')
            if(step.event==='course-added' && modal) target=null
            const nodes=target?[...document.querySelectorAll(step.recordId?`[data-record-id="${CSS.escape(step.recordId)}"]`:selector(target))]:[modal]
            const node=nodes.find(n=>n && n.getBoundingClientRect().width && n.getBoundingClientRect().height)
            if(!node){targetRef.current=null;setRect(null);return}
            targetRef.current=node
            if(['agenda:board','agenda:calendar'].includes(step.target)){
                const bounds=node.getBoundingClientRect()
                if(!scrolled || bounds.top<0 || bounds.bottom>innerHeight){
                    node.closest('[data-onboarding="agenda:scroll"]')?.scrollTo({top:0,behavior:'instant'})
                }
            }
            // Locker is a scrolling page on mobile. Its sticky topbar can cover a
            // target even after scrollIntoView, and the guidance mask blocks recovery.
            if(step.target==='locker:crates'){
                const container=node.closest('[data-onboarding="locker:scroll"]')
                const bounds=node.getBoundingClientRect()
                const headerBottom=container?.querySelector(':scope > .sticky')?.getBoundingClientRect().bottom ?? 0
                if(container && (!scrolled || bounds.top<headerBottom+6 || bounds.bottom>innerHeight-6)){
                    container.scrollTo({top:0,behavior:'instant'})
                }
            }
            if(!scrolled && visible){node.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});scrolled=true; const focus=step.kind==='info'?cardRef.current:node.matches('a,button,input,[contenteditable]')?node:node.querySelector('a,button,input,[contenteditable]');focus?.focus({preventScroll:true})}
            const r=node.getBoundingClientRect(), pad=6
            setRect({x:Math.max(0,r.left-pad),y:Math.max(0,r.top-pad),right:Math.min(innerWidth,r.right+pad),bottom:Math.min(innerHeight,r.bottom+pad),cardHeight:cardRef.current?.offsetHeight || 160,cardWidth:cardRef.current?.offsetWidth})
        }
        setMissing(false);setRect(null);measure()
        timer=setTimeout(()=>setMissing(true),6000)
        const observer=new MutationObserver(measure);observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style']})
        const cardObserver=new ResizeObserver(measure)
        if(cardRef.current)cardObserver.observe(cardRef.current)
        window.addEventListener('resize',measure);window.addEventListener('scroll',measure,true)
        const interval=setInterval(measure,500)
        return()=>{clearTimeout(timer);clearInterval(interval);observer.disconnect();cardObserver.disconnect();window.removeEventListener('resize',measure);window.removeEventListener('scroll',measure,true)}
    },[step?.id,step?.target,step?.event,step?.kind,step?.recordId,visible])
    useEffect(()=>{
        const onKey=e=>{
            if(e.key!=='Tab' || !visible)return
            const selector='a[href],button:not([disabled]),input:not([disabled]),[contenteditable="true"]'
            const target=targetInteractive?targetRef.current:null
            const focusable=[...(target?.matches(selector)?[target]:[]),...(target?.querySelectorAll(selector)||[]),...(cardRef.current?.querySelectorAll(selector)||[])].filter(n=>n.getBoundingClientRect().width)
            if(!focusable.length)return
            e.preventDefault()
            const current=focusable.indexOf(document.activeElement),next=(current+(e.shiftKey?-1:1)+focusable.length)%focusable.length
            focusable[next].focus()
        }
        document.addEventListener('keydown',onKey,true);return()=>document.removeEventListener('keydown',onKey,true)
    },[visible,targetInteractive])
    if(!step)return null
    const r=rect
    const isInfo=step.kind==='info', ExplanationIcon=isInfo?IoMdInformationCircleOutline:BsHandIndexThumbFill
    let maxWidth=Math.min(340,innerWidth-24)
    let width=isInfo?maxWidth:Math.min(r?.cardWidth || maxWidth,maxWidth)
    const height=r?.cardHeight || 160, gap=24
    const targetCenter=r?(r.x+r.right)/2:innerWidth/2
    let left=Math.min(Math.max(12,targetCenter-width/2),innerWidth-width-12)
    const fitsBelow=r && r.bottom+gap+height<=innerHeight-12
    const fitsAbove=r && r.y-gap-height>=12
    // Center above or below the focus. Full-height targets can instead use
    // the dark space beside them, with a narrower card when needed.
    if(r && !fitsBelow && !fitsAbove){
        const leftSpace=r.x-gap-12, rightSpace=innerWidth-r.right-gap-12
        if(Math.max(leftSpace,rightSpace)>=180){
            const useLeft=leftSpace>=rightSpace
            const available=useLeft?leftSpace:rightSpace
            maxWidth=Math.min(maxWidth,available)
            width=Math.min(width,available)
            left=useLeft?12+(available-width)/2:r.right+gap+(available-width)/2
        }
    }
    const top=fitsBelow ? r.bottom+gap
        : fitsAbove ? r.y-gap-height
        : Math.max(12,Math.min(innerHeight-height-12,(r?(r.y+r.bottom)/2:innerHeight/2)-height/2))
    const radius=r?Math.min(16,(r.right-r.x)/2,(r.bottom-r.y)/2):0
    const cutout=r?`M ${r.x+radius} ${r.y} H ${r.right-radius} A ${radius} ${radius} 0 0 1 ${r.right} ${r.y+radius} V ${r.bottom-radius} A ${radius} ${radius} 0 0 1 ${r.right-radius} ${r.bottom} H ${r.x+radius} A ${radius} ${radius} 0 0 1 ${r.x} ${r.bottom-radius} V ${r.y+radius} A ${radius} ${radius} 0 0 1 ${r.x+radius} ${r.y} Z`:''
    const mask=`fixed ${visible?'pointer-events-auto':'pointer-events-none'}`
    // Inert also removes hidden guidance from the accessibility tree and handles
    // retained focus, without aria-hidden hiding a still-focused Continue button.
    return <div className="fixed inset-0 z-[180] pointer-events-none transition-opacity duration-500 motion-reduce:transition-none" style={{opacity:visible?1:0}} inert={!visible} onTransitionEnd={event=>{if(changing && event.target===event.currentTarget && event.propertyName==='opacity')setStep(incomingRef.current)}}>
        <svg aria-hidden="true" className="fixed inset-0 size-full pointer-events-none">
            <path fill="rgb(0 0 0 / 0.7)" fillRule="evenodd" d={`M 0 0 H ${innerWidth} V ${innerHeight} H 0 Z ${cutout}`} />
        </svg>
        {r?<><div className={mask} style={{top:0,left:0,right:0,height:r.y}} /><div className={mask} style={{top:r.bottom,left:0,right:0,bottom:0}} /><div className={mask} style={{top:r.y,left:0,width:r.x,height:r.bottom-r.y}} /><div className={mask} style={{top:r.y,left:r.right,right:0,height:r.bottom-r.y}} /></>:<div className={mask+" inset-0"} />}
        {r && !targetInteractive && <div aria-hidden="true" className={`fixed ${visible?'pointer-events-auto':'pointer-events-none'}`} style={{top:r.y,left:r.x,width:r.right-r.x,height:r.bottom-r.y}} />}
        <div ref={cardRef} tabIndex={-1} role="dialog" aria-label="Tutorial guidance" aria-live="polite" className={`${visible?'pointer-events-auto':'pointer-events-none'} fixed bg-neutral5 text-neutral0 border border-neutral3 rounded-2xl p-4 shadow-xl flex flex-col gap-3`} style={{top,left,width:isInfo?width:'max-content',maxWidth}}>
            <div className="flex items-start gap-2">
                <ExplanationIcon className="size-4 shrink-0 mt-0.5 text-neutral1" aria-hidden="true" />
                <p className="text-sm min-w-0">{r?step.text:missing?'You ran into a weird issue with the tutorial. Try again.':'Loading...'}</p>
            </div>
            {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
            {r && step.kind==='info' && <Button type="primary" onClick={onNext} disabled={busy}>Continue</Button>}
            {(error || !r && missing) && <Button onClick={onRetry} disabled={busy}>Retry</Button>}
        </div>
    </div>
}
