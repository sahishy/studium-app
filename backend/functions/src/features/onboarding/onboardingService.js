import { randomUUID, randomInt } from 'node:crypto'
import { db } from '../../lib/firebaseAdmin.js'
import { readAccount, writeAccount, CRATE_CATALOG } from '../economy/economyService.js'
import { rollCrateRarityPath } from '../economy/crateRolls.js'
import { DUPLICATE_REFUND } from '../economy/progression.js'
import { ONLINE_EVENTS, stepsFor, rewardFor } from './steps.js'
const stateRef = uid => db.collection('onboarding').doc(uid)
const view = state => {
    const steps=state.active ? stepsFor(state.active.path,state.active) : []
    // A saved Play run may already have advanced past the removed closing step.
    const active=state.active?.path==='play' && state.active.index>steps.length ? {...state.active,index:steps.length} : state.active
    return {...state,active,steps,pending:ONLINE_EVENTS.filter(event=>!state.acknowledged?.includes(event.id)).sort((a,b)=>a.order-b.order)}
}
export const getOnlineEvents = async uid => {
    const snap = await stateRef(uid).get(), state=snap.data() || {acknowledged:[],rewarded:[]}
    return {...view(state),pending:ONLINE_EVENTS.filter(event=>!state.acknowledged?.includes(event.id)).sort((a,b)=>a.order-b.order)}
}
export const acknowledgeEvent = (uid,eventId) => db.runTransaction(async tx=>{
    if(!ONLINE_EVENTS.some(event=>event.id===eventId))throw new Error('Unknown event.')
    const ref=stateRef(uid),snap=await tx.get(ref),state=snap.data() || {}
    if(state.active)throw new Error('Finish your active tutorial first.')
    tx.set(ref,{...state,acknowledged:[...new Set([...(state.acknowledged || []),eventId])]})
    return {ok:true}
})
export const startOnboarding = (uid,path) => db.runTransaction(async tx=>{
    if(!['play','study','both'].includes(path))throw new Error('Unknown tutorial path.')
    const ref=stateRef(uid),snap=await tx.get(ref),state=snap.data() || {acknowledged:[],rewarded:[]}
    if(state.active)return view(state)
    const next={...state,acknowledged:[...new Set([...(state.acknowledged || []),'onboarding:v1'])],active:{id:randomUUID(),path,stepsVersion:3,freeCrateIncluded:path!=='study' && !state.rewarded?.includes('play') && !state.crateRewarded,index:0,practiceRound:0,artifacts:{},startedAt:new Date().toISOString()}}
    tx.set(ref,next);return view(next)
})
export const reserveArtifact = (uid,{runId,kind,recordId}) => db.runTransaction(async tx=>{
    if(!['task-one','task-two','course'].includes(kind))throw new Error('Invalid practice record.')
    if(typeof recordId !== 'string' || !/^[A-Za-z0-9_-]{1,180}$/.test(recordId))throw new Error('Invalid record ID.')
    const ref=stateRef(uid),snap=await tx.get(ref),state=snap.data(),run=state?.active
    if(run?.id!==runId)throw new Error('Tutorial is no longer active.')
    const step=stepsFor(run.path,run)[run.index]
    if(step?.event !== (kind==='course'?'course-added':kind))throw new Error('This practice record is not needed yet.')
    const collection=kind==='course'?'courses':'tasks',record=await tx.get(db.collection(collection).doc(recordId))
    if(record.exists){
        if(record.data().tutorialRunId===run.id)return {tutorialRunId:run.id}
        if(kind!=='course')throw new Error('This task already exists outside the tutorial.')
        return {tutorialRunId:null,existing:true}
    }
    const previous=run.artifacts[kind]
    if(previous && previous!==recordId)run.extraArtifacts=[...(run.extraArtifacts || []),{kind,id:previous}]
    run.artifacts[kind]=recordId
    tx.set(ref,state)
    return {tutorialRunId:run.id}
})
const textOf = task => typeof task.title==='string'?task.title:(task.title?.segments || []).map(s=>s.rawText || s.text || '').join(' ').toLowerCase()
export const advanceOnboarding = (uid,{runId,index,event,location}) => db.runTransaction(async tx=>{
    const ref=stateRef(uid),snap=await tx.get(ref),state=snap.data(),run=state?.active
    if(!run || run.id!==runId)throw new Error('Tutorial is no longer active.')
    if(index < run.index)return view(state)
    if(index!==run.index)throw new Error('Tutorial step is out of order.')
    const step=stepsFor(run.path,run)[index]
    if(!step)throw new Error('Complete the tutorial to collect your reward.')
    if(step.kind==='action'){
        if(event!==step.event)throw new Error('Finish this activity first.')
        if(event==='navigate' && !String(location || '').startsWith(step.destination))throw new Error('Open the highlighted page first.')
        if(event==='tutorial-crate' && !run.crateResult)throw new Error('Open your free crate first.')
        if(event==='practice' && run.practiceRound!==2)throw new Error('Finish the practice match first.')
        if(event==='task-one' || event==='task-two' || event==='task-deleted'){
            const kind=event==='task-deleted'?'task-two':event,id=run.artifacts[kind]
            if(!id)throw new Error('Create the practice task first.')
            const task=await tx.get(db.collection('tasks').doc(id))
            if(event==='task-deleted'){if(task.exists)throw new Error('Delete the practice task first.')}
            else {
                const data=task.data(), segments=data?.title?.segments || []
                const date=segments.some(s=>s.type==='widget' && s.widgetType==='date')
                const course=segments.some(s=>s.type==='widget' && s.widgetType==='course' && s.value?.courseId==='LCPS-750100')
                if(!task.exists || data.tutorialRunId!==run.id || !textOf(data).includes(event==='task-one'?'homework':'test') || !date || event==='task-two' && !course)throw new Error('Type the example with its date and press Enter.')
            }
        }
        if(event==='course-added'){
            const enrolled=await tx.get(db.collection('courses').doc(`LCPS-750100_${uid}`))
            if(!enrolled.exists)throw new Error('Add AP US History first.')
        }
    }
    run.index++;tx.set(ref,state);return view(state)
})
export const answerPractice = (uid,{runId,answer,calculatorOpened}) => db.runTransaction(async tx=>{
    const ref=stateRef(uid),snap=await tx.get(ref),state=snap.data(),run=state?.active
    if(run?.id!==runId || stepsFor(run.path,run)[run.index]?.id!=='practice')throw new Error('Practice match is not active.')
    if(run.practiceRound>=2)return view(state)
    const correct=run.practiceRound===0?answer==='B':Number(answer)===24 && calculatorOpened===true
    if(!correct)throw new Error(run.practiceRound===0?'Try the word that means excited.':'Open the calculator and try 8 × 3.')
    run.practiceRound++;tx.set(ref,state);return view(state)
})
export const completeOnboarding = (uid,{runId}) => db.runTransaction(async tx=>{
    const ref=stateRef(uid),snap=await tx.get(ref),state=snap.data()
    if(!state?.active){if(state?.lastRunId===runId)return {...view(state),reward:{xp:0}};throw new Error('No active tutorial.')}
    const run=view(state).active
    if(run.id!==runId || run.index!==stepsFor(run.path,run).length)throw new Error('Reach the end of the tutorial first.')
    const account=await readAccount(tx,uid)
    const artifacts=await Promise.all([...Object.entries(run.artifacts),...(run.extraArtifacts || []).map(a=>[a.kind,a.id])].map(async([kind,id])=>({kind,snap:await tx.get(db.collection(kind==='course'?'courses':'tasks').doc(id))})))
    for(const artifact of artifacts)if(artifact.snap.data()?.tutorialRunId===run.id)tx.delete(artifact.snap.ref)
    const unpaid=rewardFor(run.path,state.rewarded),reward={xp:unpaid.length*150}
    const result=writeAccount(tx,account,reward)
    const next={...state,active:null,lastRunId:run.id,rewarded:[...new Set([...(state.rewarded || []),...unpaid])],completedAt:new Date().toISOString()}
    tx.set(ref,next)
    return {...view(next),...result,reward}
})

// The reward and entitlement are committed together. Reconnecting replays the same reveal.
export const openTutorialCrate = (uid,{runId}) => db.runTransaction(async tx=>{
    const ref=stateRef(uid),snap=await tx.get(ref),state=snap.data(),run=state?.active
    if(run?.id!==runId || stepsFor(run.path,run)[run.index]?.event!=='tutorial-crate')throw new Error('Your free crate is not available here.')
    if(run.crateResult)return run.crateResult
    if(!run.freeCrateIncluded || state.crateRewarded || state.rewarded?.includes('play'))throw new Error('Your tutorial crate has already been collected.')
    const account=await readAccount(tx,uid)
    const rare=CRATE_CATALOG.filter(item=>item.rarity==='Rare')
    const unowned=rare.filter(item=>!account.wallet.inventory.includes(item.id))
    const pool=unowned.length?unowned:rare,color=pool[randomInt(pool.length)]
    const duplicate=account.wallet.inventory.includes(color.id)
    const wallet={...account.wallet,balance:account.wallet.balance+(duplicate?DUPLICATE_REFUND:0),inventory:duplicate?account.wallet.inventory:[...account.wallet.inventory,color.id]}
    const rarityPath=rollCrateRarityPath({Rare:1},()=>randomInt(1000000000)/1000000000)
    const result={color,rarityPath,duplicate,refund:duplicate?DUPLICATE_REFUND:0,wallet}
    tx.set(account.userRef,{progress:account.progress},{merge:true})
    tx.set(account.walletRef,wallet,{merge:true})
    run.crateResult=result
    tx.set(ref,{...state,crateRewarded:true})
    return result
})

// Exposed only by the emulator router. Preserve unrelated work and previously earned rewards.
export const resetOnboardingForTesting = uid => db.runTransaction(async tx=>{
    const ref=stateRef(uid),snap=await tx.get(ref),run=snap.data()?.active
    if(run){
        const owned=await Promise.all([...Object.entries(run.artifacts || {}),...(run.extraArtifacts || []).map(a=>[a.kind,a.id])].map(async([kind,id])=>tx.get(db.collection(kind==='course'?'courses':'tasks').doc(id))))
        for(const record of owned)if(record.data()?.tutorialRunId===run.id)tx.delete(record.ref)
    }
    const next={acknowledged:(snap.data()?.acknowledged || []).filter(id=>id!=='onboarding:v1'),rewarded:[],active:null,crateRewarded:false}
    tx.set(ref,next)
    return view(next)
})
