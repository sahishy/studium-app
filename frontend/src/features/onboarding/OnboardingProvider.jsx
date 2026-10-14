import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import PathChoice from './PathChoice'
import { post, request } from '../../shared/services/apiService'
import { useMultiplayer } from '../multiplayer/contexts/MultiplayerContext'
import { useModal } from '../../shared/contexts/ModalContext'
import { useEconomy } from '../economy/EconomyContext'
import { useRewardFx } from '../economy/RewardFxContext'
import { useTasks } from '../agenda/contexts/TasksContext'
import { useCourses } from '../courses/contexts/CoursesContext'
import { setTutorialBridge } from './onboardingBridge'
import Spotlight from './Spotlight'
import useDialogFocus from './useDialogFocus'
import { getOnlineEventRenderer } from './eventRegistry'
import Button from '../../shared/components/ui/Button'
import { OnboardingContext as Context } from './OnboardingContext'
export default function OnboardingProvider({profile,children}){
    const [state,setState]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[practice,setPractice]=useState(false),[reward,setReward]=useState(null)
    const [crateOpening,setCrateOpening]=useState(false)
    const [retry,setRetry]=useState(0),busyRef=useRef(false),progressQueue=useRef(Promise.resolve()),stateRef=useRef(null)
    const [readyStep,setReadyStep]=useState(null)
    const [sidebarTarget,setSidebarTarget]=useState(null)
    const navigate=useNavigate(),location=useLocation(),{session}=useMultiplayer(),{isOpen}=useModal(),{refresh}=useEconomy(),{celebrateReward}=useRewardFx(),{courseIds}=useCourses()
    const {user:tasks,isReady:tasksReady}=useTasks()
    stateRef.current=state
    const run=state?.active,step=state?.steps?.[run?.index]
    const stepKey=run && step ? `${run.id}:${step.id}` : null
    const guidanceReady=!!stepKey && readyStep===stepKey
    useEffect(()=>{
        if(!stepKey)return
        const timer=setTimeout(()=>setReadyStep(stepKey),1200)
        return()=>clearTimeout(timer)
    },[stepKey])
    useEffect(()=>{
        // Keep temporary sidebar expansion stable until the outgoing fade ends.
        const timer=setTimeout(()=>setSidebarTarget(step?.target || null),534)
        return()=>clearTimeout(timer)
    },[stepKey,step?.target])
    const blocked=session?.status==='in_room' || session?.status==='queue'
    const sidebarGroup=sidebarTarget?.startsWith('nav:') ? (['/agenda','/courses','/resources'].some(p=>sidebarTarget.includes(p))?'study':'play') : null
    useEffect(()=>{let live=true;request({path:'/v1/events'}).then(next=>{if(live)setState(next)}).catch(err=>{if(live)setError(err.message)});return()=>{live=false;setTutorialBridge(null)}},[profile.uid,retry])
    useEffect(()=>{setTutorialBridge(state,()=>progressQueue.current)},[state])
    useEffect(()=>{const reconnect=()=>setRetry(n=>n+1);const reset=()=>{setPractice(false);setReward(null);setCrateOpening(false);setError('');reconnect()};window.addEventListener('online',reconnect);window.addEventListener('onboarding:reset',reset);return()=>{window.removeEventListener('online',reconnect);window.removeEventListener('onboarding:reset',reset)}},[])
    const advance=useCallback((event,detail={})=>{
        const current=stateRef.current,active=current?.active,currentStep=current?.steps?.[active?.index]
        if(!active || !currentStep || (event && event!==currentStep.event))return Promise.resolve()
        if(currentStep.id==='calendar'){
            try{localStorage.setItem('agenda:lastTab','list')}catch{/* Preferences can fall back in private browsing. */}
        }
        const index=active.index,runId=active.id,pathname=location.pathname
        // Respond to the local action immediately. Persist in order behind the task write,
        // retaining server validation and transaction-owned completion rewards.
        const next={...current,active:{...active,index:index+1,artifacts:{...active.artifacts,...(detail.recordId?{[event]:detail.recordId}:{})}}}
        stateRef.current=next;setState(next);setError('')
        const pending=progressQueue.current.then(async()=>{
            await detail.ready
            const saved=await post('/v1/onboarding/advance',{runId,index,event,location:pathname})
            setState(local=>local?.active?.id===runId && local.active.index>saved.active.index ? {...saved,active:{...saved.active,index:local.active.index,artifacts:{...saved.active.artifacts,...local.active.artifacts}}} : saved)
        })
        progressQueue.current=pending.catch(async err=>{
            setError(err.message)
            try{const saved=await request({path:'/v1/events'});stateRef.current=saved;setState(saved)}catch{/* Retry remains available. */}
        })
        return progressQueue.current
    },[location.pathname])
    const start=async(path)=>{if(busyRef.current)return;busyRef.current=true;setBusy(true);try{const next=await post('/v1/onboarding/start',{path});setState(next);setReward(null);setError('');navigate(next.steps[next.active.index]?.route || '/play')}catch(err){setError(err.message);throw err}finally{setBusy(false);busyRef.current=false}}
    // Routing belongs to the controller. Screens only register focus targets.
    useEffect(()=>{
        if(!step || blocked)return
        const practiceRoute=`/play/tutorial/${run.id}`
        if(step.id==='practice' && (practice || location.pathname===practiceRoute || run.practiceRound>0)){
            if(location.pathname!==practiceRoute)navigate(practiceRoute,{replace:true})
            return
        }
        if(step.event==='navigate' && location.pathname===step.destination){void advance('navigate');return}
        if(!guidanceReady)return
        if(location.pathname!==step.route)navigate(step.route,{replace:true})
    },[step,run?.id,run?.practiceRound,practice,guidanceReady,blocked,location.pathname,advance,navigate])
    useEffect(()=>{
        if(!step || blocked || !guidanceReady)return
        const updateNavigation=()=>window.dispatchEvent(new Event(step.target.startsWith('nav:') && innerWidth<1024 ? 'onboarding:open-navigation' : 'onboarding:close-navigation'))
        updateNavigation()
        window.addEventListener('resize',updateNavigation)
        return()=>window.removeEventListener('resize',updateNavigation)
    },[step,blocked,guidanceReady])
    useEffect(()=>{
        if(!step || blocked)return
        const action=e=>{
            if(e.detail.event==='task-input-rejected'){setError(e.detail.message);return}
            if(e.detail.event===step.event && (step.event!=='task-deleted' || !e.detail.recordId || e.detail.recordId===run.artifacts?.['task-two']))void advance(e.detail.event,e.detail)
        }
        const click=e=>{
            const target=e.target.closest('[data-onboarding]')
            if(step.event==='navigate' && target?.dataset.onboarding===step.target && step.target.startsWith('nav:')){
                e.preventDefault();e.stopPropagation();
                window.dispatchEvent(new Event('onboarding:close-navigation'))
                navigate(step.destination)
                return
            }
            if(step.id==='practice' && target?.dataset.onboarding==='lobby:play'){e.preventDefault();e.stopPropagation();setPractice(true);navigate(`/play/tutorial/${run.id}`)}
        }
        window.addEventListener('onboarding:action',action);document.addEventListener('click',click,true)
        return()=>{window.removeEventListener('onboarding:action',action);document.removeEventListener('click',click,true)}
    },[step,run?.id,run?.artifacts,advance,blocked,navigate])
    useEffect(()=>{if(step?.event==='course-added' && courseIds.includes('LCPS-750100'))advance('course-added')},[step,courseIds,advance])
    useEffect(()=>{
        if(!tasksReady || !step || blocked)return
        const kind=step.event==='task-deleted'?'task-two':step.event
        if(!['task-one','task-two'].includes(kind))return
        const id=run.artifacts?.[kind]
        if(!id)return
        const exists=tasks.some(task=>task.uid===id)
        if(step.event==='task-deleted' ? !exists : exists)advance(step.event)
    },[tasksReady,tasks,step,run,blocked,advance])
    const complete=useCallback(async()=>{
        if(!run || busyRef.current)return
        busyRef.current=true;setBusy(true)
        try{await progressQueue.current;const saved=stateRef.current;if(saved?.active?.id!==run.id || saved.active.index!==saved.steps.length)return;const next=await post('/v1/onboarding/complete',{runId:run.id});setState(next);setReward(next.reward);celebrateReward(next.reward);await refresh();setError('')}
        catch(err){setError(err.message)}finally{setBusy(false);busyRef.current=false}
    },[run,refresh,celebrateReward])
    useEffect(()=>{if(run && !step && !blocked)complete()},[run,step,blocked,complete])
    const crateOffer=step?.event==='tutorial-crate' ? {
        purchase:async()=>{const result=await post('/v1/onboarding/crate',{runId:run.id});await refresh();return result},
        onOpening:setCrateOpening,
        onDismiss:()=>{setCrateOpening(false);void advance('tutorial-crate')},
    } : null
    const pendingEvent=state?.pending?.[0]
    const canPresent=!!pendingEvent && !run && !blocked && !isOpen && !reward
    const showChoice=canPresent && pendingEvent.type==='onboarding'
    const choiceRef=useRef(null), rewardRef=useRef(null)
    useDialogFocus(choiceRef,showChoice)
    useDialogFocus(rewardRef,!!reward)
    const EventRenderer=canPresent ? getOnlineEventRenderer(pendingEvent.type) : null
    const acknowledge=async()=>{
        try {
            await post('/v1/events/acknowledge',{eventId:pendingEvent.id})
            setState(s=>({...s,pending:s.pending.filter(e=>e.id!==pendingEvent.id)}))
        } catch(err){setError(err.message)}
    }
    return <Context.Provider value={{start,active:run,step,ready:!!state,crateOffer,practiceActions:{onAnswer:async(answer,calculatorOpened)=>{await progressQueue.current;setState(await post('/v1/onboarding/practice',{runId:run.id,answer,calculatorOpened}))},onReturn:async()=>{await advance('practice');setPractice(false);navigate('/play')}},sidebarGroup:blocked?null:sidebarGroup}}>{children}
        {EventRenderer && <EventRenderer event={pendingEvent} onAcknowledge={acknowledge} error={error} />}
        {showChoice && <PathChoice dialogRef={choiceRef} busy={busy} error={error} onStart={start} onSkip={acknowledge} />}
        {run && step && !blocked && !practice && !location.pathname.startsWith('/play/tutorial/') && !crateOpening && !isOpen && <Spotlight step={{...step,recordId:step.target==='agenda:sample-one'?run.artifacts?.['task-one']:step.target==='agenda:sample-two'?run.artifacts?.['task-two']:undefined}} visible={guidanceReady && location.pathname===step.route} busy={busy} error={error} onNext={()=>advance()} onRetry={()=>{setError('');setRetry(n=>n+1)}} />}

        {run && !step && error && <div role="alert" className="fixed inset-0 z-[190] bg-black/75 flex flex-col gap-4 items-center justify-center text-neutral0"><p>{error}</p><Button onClick={complete}>Retry completion</Button></div>}
        {reward && <div ref={rewardRef} role="dialog" aria-modal="true" aria-label="Tutorial complete" className="fixed inset-0 z-[190] bg-black/75 flex items-center justify-center p-6"><div className="bg-neutral5 rounded-2xl p-8 flex flex-col items-center gap-4 text-neutral0"><h2 className="text-2xl font-bold">You’re ready!</h2><p>{reward.xp ? `Welcome to Studium! You earned ${reward.xp} XP.` : 'Tutorial complete. You’ve already collected its XP reward.'}</p><Button type="primary" className='mt-4 w-full py-4' onClick={()=>setReward(null)}>Explore Studium</Button></div></div>}
        {!state && error && <div role="alert" className="fixed bottom-4 right-4 z-[190] rounded-xl p-4 bg-neutral5">Could not load tutorials. <Button onClick={()=>setRetry(n=>n+1)}>Retry</Button></div>}
    </Context.Provider>
}
