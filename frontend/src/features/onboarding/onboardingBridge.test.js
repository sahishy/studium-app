import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Buffer } from 'node:buffer'
test('Local examples advance immediately while record reservation waits for prior progress',async()=>{
    const source=await readFile(new URL('./onboardingBridge.js',import.meta.url),'utf8')
    const calls=[],events=[]
    globalThis.window={dispatchEvent:event=>events.push(event.detail)}
    globalThis.CustomEvent=class {constructor(type,{detail}){this.type=type;this.detail=detail}}
    globalThis.__tutorialPost=async(path,body)=>{calls.push({path,body});return {tutorialRunId:body.runId}}
    const bridge=await import(`data:text/javascript;base64,${Buffer.from(source.replace("import { post } from '../../shared/services/apiService'",'const post=globalThis.__tutorialPost')).toString('base64')}`)
    let resolvePrior
    const prior=new Promise(resolve=>{resolvePrior=resolve})
    const ready=new Promise(()=>{})
    const title={segments:[{text:'Finish homework '},{rawText:'tomorrow',widgetType:'date',value:{dueDate:'2026-10-13'}}]}
    bridge.setTutorialBridge({active:{id:'run',index:0,artifacts:{}},steps:[{event:'task-one'}]},()=>prior)
    assert.equal(bridge.tutorialTaskCreationError(title),null)
    const wrong={segments:[{text:'Some other homework '},{rawText:'tomorrow',widgetType:'date',value:{dueDate:'2026-10-13'}}]}
    assert.match(bridge.tutorialTaskCreationError(wrong),/Finish homework tomorrow/)
    const capitals={segments:[{text:'FINISH HOMEWORK '},{rawText:'TOMORROW',widgetType:'date',value:{dueDate:'2026-10-13'}}]}
    assert.equal(bridge.tutorialTaskCreationError(capitals),null)
    await assert.rejects(bridge.prepareTutorialRecord('task','wrong',wrong),/Finish homework tomorrow/)
    bridge.tutorialTaskQueued('example',{title},ready)
    assert.ok(bridge.tutorialTaskCreationError(title),'A sample cannot be queued twice')
    assert.equal(events[0].event,'task-one')
    assert.equal(events[0].ready,ready)
    // UI may already be showing the next step; the captured intent still owns this record.
    bridge.setTutorialBridge({active:{id:'run',index:1,artifacts:{}},steps:[{event:'task-one'},{kind:'info'}]})
    const reservation=bridge.prepareTutorialRecord('task','example',title)
    await Promise.resolve()
    assert.equal(calls.length,0)
    resolvePrior()
    assert.deepEqual(await reservation,{tutorialRunId:'run',tutorialKind:'task-one'})
    assert.equal(calls[0].body.kind,'task-one')
    assert.ok(bridge.tutorialTaskCreationError(title),'Tasks are blocked outside the creation step')
    const second={segments:[{rawText:'APUSH',widgetType:'course',value:{courseId:'LCPS-750100'}},{text:' test '},{rawText:'tomorrow',widgetType:'date',value:{dueDate:'2026-10-13'}}]}
    bridge.setTutorialBridge({active:{id:'run',index:0,artifacts:{}},steps:[{event:'task-two'}]})
    assert.equal(bridge.tutorialTaskCreationError(second),null)
    assert.ok(bridge.tutorialTaskCreationError({...second,segments:second.segments.slice(1)}))
    bridge.setTutorialBridge({active:{id:'run',index:0,artifacts:{'task-two':'owned'}},steps:[{event:'task-deleted'}]})
    bridge.tutorialDeletionQueued('unrelated',ready)
    assert.equal(events.length,1)
    bridge.tutorialDeletionQueued('owned',ready)
    assert.equal(events[1].event,'task-deleted')
    delete globalThis.window;delete globalThis.CustomEvent;delete globalThis.__tutorialPost
})
