import { post } from '../../shared/services/apiService'
let current = null
let progressBarrier = () => Promise.resolve()
export const setTutorialBridge = (state, barrier) => {current=state;if(barrier)progressBarrier=barrier}
export const tutorialStep = () => current?.steps?.[current?.active?.index]
export const tutorialSignal = (event, detail = {}) => window.dispatchEvent(new CustomEvent('onboarding:action',{detail:{event,...detail}}))
export const prepareTutorialRecord = async (kind, recordId, title) => {
    const queued=queuedTutorialTasks.get(recordId)
    if(kind==='task' && !queued){
        const message=tutorialTaskCreationError(title)
        if(message)throw new Error(message)
    }
    if(kind==='task')kind=queued?.kind || tutorialStep()?.event
    if(!['task-one','task-two','course'].includes(kind))return {}
    const step=queued?{event:queued.kind}:tutorialStep(),run=queued?.run || current?.active
    if(!run)return {}
    const expected=kind==='course'?'course-added':kind
    if(step?.event!==expected)return {}
    if(kind!=='course' && !isExample(kind,title))throw new Error('Use the task shown in the tutorial.')
    await queued?.barrier
    const result=await post('/v1/onboarding/artifact',{runId:run.id,kind,recordId})
    return result.tutorialRunId ? {tutorialRunId:result.tutorialRunId,tutorialKind:kind} : {}
}

const queuedTutorialTasks = new Map()
const sampleText={'task-one':'Finish homework tomorrow','task-two':'apush test tomorrow'}
const titleText=title=>typeof title==='string'?title:(title?.segments || []).map(s=>s.rawText ?? s.displayText ?? s.text ?? '').join('')
const isExample = (kind,title) => {
    const segments=title?.segments || []
    const text=titleText(title).trim().toLowerCase()
    return text===sampleText[kind]?.toLowerCase() && segments.some(s=>s.widgetType==='date') && (kind!=='task-two' || segments.some(s=>s.widgetType==='course' && s.value?.courseId==='LCPS-750100'))
}
export const tutorialTaskCreationError = title => {
    if(!current?.active)return null
    const kind=tutorialStep()?.event
    const alreadyQueued=[...queuedTutorialTasks.values()].some(task=>task.run.id===current.active.id && task.kind===kind)
    if(!alreadyQueued && sampleText[kind] && isExample(kind,title))return null
    return sampleText[kind]?`Type “${sampleText[kind]}” to continue.`:'Follow the current tutorial step before adding another task.'
}
export const validateTutorialTaskInput = payload => {
    const message=tutorialTaskCreationError(payload.title)
    if(!message)return payload
    tutorialSignal('task-input-rejected',{message})
    return false
}
// Small queue callbacks; all tutorial interpretation stays inside this feature.
export const tutorialTaskQueued = (recordId,task,ready) => {
    const step=tutorialStep(),run=current?.active,kind=step?.event
    if(!run || !['task-one','task-two'].includes(kind) || !isExample(kind,task.title))return
    queuedTutorialTasks.set(recordId,{kind,run,barrier:progressBarrier()})
    tutorialSignal(kind,{recordId,ready})
}
export const tutorialDeletionQueued = (recordId,ready) => {
    if(tutorialStep()?.event==='task-deleted' && current?.active?.artifacts?.['task-two']===recordId)tutorialSignal('task-deleted',{ready})
}
