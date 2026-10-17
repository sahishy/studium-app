import test from 'node:test'
import assert from 'node:assert/strict'
import { stepsFor, rewardFor, ONLINE_EVENTS } from './steps.js'
import { canClaimGrandQuest } from '../socials/circlePolicy.js'
test('Both transitions from the practice match into Study, with a single final payout',()=>{
    const ids=stepsFor('both').map(s=>s.id)
    assert.equal(stepsFor('play').at(-2).id,'practice')
    assert.equal(ids.indexOf('practice')+1,ids.indexOf('transition'))
    assert.ok(ids.indexOf('transition')<ids.indexOf('task-one'))
    assert.ok(!ids.includes('play-end'))
    assert.deepEqual(rewardFor('both',[]),['play','study'])
    assert.deepEqual(rewardFor('both',['play']),['study'])
    assert.deepEqual(rewardFor('study',['study']),[])
    assert.deepEqual(rewardFor('both',['play','study']),[])
})
test('New tutorials omit the Lobby introduction without shifting saved runs',()=>{
    const fresh=stepsFor('play',{id:'new-run',stepsVersion:3})
    assert.deepEqual(fresh.slice(0,2).map(step=>step.id),['rank','modes'])
    assert.equal(fresh[0].target,'lobby:game-card')
    assert.ok(!stepsFor('both').some(step=>step.id==='lobby'))
    assert.equal(stepsFor('play',{id:'version-two',stepsVersion:2})[14].id,'practice')
    assert.equal(stepsFor('both',{id:'version-two',stepsVersion:2})[15].id,'transition')
    const saved=stepsFor('play',{id:'saved-run',index:13})
    assert.equal(saved[13].id,'practice')
    assert.equal(stepsFor('both',{id:'saved-run',index:14})[14].id,'transition')
})
test('Grand Quest rewards require current-primary eligibility',()=>{
    const eligible={primaryCircleId:'a',circleId:'a',eligible:true,member:true,claimed:false}
    assert.equal(canClaimGrandQuest(eligible),true)
    for(const key of ['eligible','member'])assert.equal(canClaimGrandQuest({...eligible,[key]:false}),false)
    assert.equal(canClaimGrandQuest({...eligible,claimed:true}),false)
    assert.equal(canClaimGrandQuest({...eligible,primaryCircleId:'b'}),false)
    assert.equal(new Set(ONLINE_EVENTS.map(e=>e.id)).size,ONLINE_EVENTS.length)
})
