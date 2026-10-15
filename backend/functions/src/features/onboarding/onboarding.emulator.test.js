import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
test('emulator: resumable Both, practice validation, cleanup ownership and lifetime XP', {skip:process.env.USE_FIREBASE_EMULATORS!=='true'},async()=>{
    const {db}=await import('../../lib/firebaseAdmin.js')
    const {getOnlineEvents,startOnboarding,advanceOnboarding,answerPractice,reserveArtifact,completeOnboarding,openTutorialCrate}=await import('./onboardingService.js')
    const uid=`onboarding_qa_${randomUUID()}`,user=db.collection('users').doc(uid),state=db.collection('onboarding').doc(uid)
    const course=db.collection('courses').doc(`LCPS-750100_${uid}`),one=db.collection('tasks').doc(`${uid}_one`),two=db.collection('tasks').doc(`${uid}_two`)
    try{
        await user.set({progress:{level:1,xp:0,curveVersion:3},profile:{displayName:'TutorialQA'}})
        assert.equal((await getOnlineEvents(uid)).pending[0].type,'onboarding')
        let session=await startOnboarding(uid,'both'),run=session.active
        await assert.rejects(completeOnboarding(uid,{runId:run.id}),/Reach the end/)
        const parserSource=(await readFile(new URL('../../../../../frontend/src/features/agenda/utils/naturalLanguage.jsx',import.meta.url),'utf8')).replace("'./taskCircleUtils'",JSON.stringify(new URL('../../../../../frontend/src/features/agenda/utils/taskCircleUtils.js',import.meta.url).href))
        const {parseTextToTaskTitle}=await import(`data:text/javascript;base64,${Buffer.from(parserSource).toString('base64')}`)
        while(session.active.index<session.steps.length){
            const step=session.steps[session.active.index]
            if(step.event==='tutorial-crate'){
                const [a,b]=await Promise.all([openTutorialCrate(uid,{runId:run.id}),openTutorialCrate(uid,{runId:run.id})])
                assert.deepEqual(a,b)
                assert.equal(a.color.rarity,'Rare')
                assert.equal(a.rarityPath.at(-1),'Rare')
                assert.equal(a.wallet.balance,0)
                assert.equal(a.wallet.inventory.length,1)
            }
            if(step.event==='practice'){
                await assert.rejects(answerPractice(uid,{runId:run.id,answer:'A'}),/Try the word/)
                await answerPractice(uid,{runId:run.id,answer:'B'})
                await assert.rejects(answerPractice(uid,{runId:run.id,answer:'24',calculatorOpened:false}),/calculator/)
                await answerPractice(uid,{runId:run.id,answer:'24',calculatorOpened:true})
            }
            if(step.event==='task-one' || step.event==='task-two'){
                const ref=step.event==='task-one'?one:two
                await reserveArtifact(uid,{runId:run.id,kind:step.event,recordId:ref.id})
                const text=step.event==='task-one'?'Finish homework tomorrow':'apush test in 2 days'
                await ref.set({userId:uid,tutorialRunId:run.id,tutorialKind:step.event,title:parseTextToTaskTitle(text,{courses:[{courseId:'LCPS-750100',title:'AP US History',subject:'History',alias:[]}]}).title})
            }
            if(step.event==='course-added'){
                await reserveArtifact(uid,{runId:run.id,kind:'course',recordId:course.id})
                await course.set({studentId:uid,courseId:'LCPS-750100',tutorialRunId:run.id,tutorialKind:'course'})
            }
            if(step.event==='task-deleted')await two.delete()
            session=await advanceOnboarding(uid,{runId:run.id,index:session.active.index,event:step.event,location:step.destination || step.route})
        }
        const results=await Promise.all([completeOnboarding(uid,{runId:run.id}),completeOnboarding(uid,{runId:run.id})])
        assert.equal(results.reduce((sum,r)=>sum+r.reward.xp,0),300)
        assert.equal((await one.get()).exists,false)
        assert.equal((await course.get()).exists,false)
        assert.equal((await getOnlineEvents(uid)).pending.length,0)
        assert.deepEqual((await state.get()).data().rewarded,['play','study'])
        // Existing enrollment must never be reserved for cleanup on a replay.
        await course.set({studentId:uid,courseId:'LCPS-750100',customization:{color:'#f87171'}})
        session=await startOnboarding(uid,'study')
        await state.update({'active.index':session.steps.findIndex(s=>s.event==='course-added')})
        const reservation=await reserveArtifact(uid,{runId:session.active.id,kind:'course',recordId:course.id})
        assert.equal(reservation.existing,true)
        await state.update({'active.index':session.steps.length})
        const replay=await completeOnboarding(uid,{runId:session.active.id})
        assert.equal(replay.reward.xp,0)
        assert.equal((await course.get()).exists,true)
    }finally{await Promise.all([user.delete(),state.delete(),course.delete(),one.delete(),two.delete(),db.collection('wallets').doc(uid).delete()])}
})
test('emulator: contributions reach all Circles, snapshot eligibility, and concurrent claims pay once', {skip:process.env.USE_FIREBASE_EMULATORS!=='true'},async()=>{
    const {db}=await import('../../lib/firebaseAdmin.js')
    const {mutateMembership,setPrimaryCircle,claimCircleGrandQuest,editCircleIdentity}=await import('../socials/circleApi.js')
    const {readCircleContexts,contributeQuests}=await import('../socials/circleGoals.js')
    const {grandQuestRound}=await import('../socials/circlePolicy.js')
    const prefix=`circle_qa_${randomUUID()}`,uids=[prefix+'_a',prefix+'_b',prefix+'_c'],ids=[]
    try{
        for(const uid of uids){await db.collection('users').doc(uid).set({progress:{level:1,xp:0,curveVersion:3},primaryCircleId:null});await db.collection('userStats').doc(uid).set({play:{'sat-classic':{placed:true,elo:100}}})}
        const profile={title:'Tutorial QA',flair:'Team',banner:{bgColor:'#9ca3af33',iconColor:'#9ca3af',iconIndex:0}}
        ids.push((await mutateMembership(uids[0],{action:'create',profile})).circleId,(await mutateMembership(uids[0],{action:'create',profile})).circleId)
        await Promise.all(ids.map(circleId=>mutateMembership(uids[1],{action:'join',circleId})))
        const record=async(completed)=>{const {ensureMembershipIndex}=await import('../socials/circleMemberships.js');await ensureMembershipIndex(uids[0]);return db.runTransaction(async tx=>{const contexts=await readCircleContexts(tx,[uids[0]],{questInstances:completed.map(q=>({userId:uids[0],dayKey:'2026-10-12',instanceId:q.instanceId}))});contributeQuests(tx,contexts,{userId:uids[0],dayKey:'2026-10-12',completed})})}
        await setPrimaryCircle(uids[0],ids[0])
        await setPrimaryCircle(uids[1],ids[1])
        const amount=Math.max(...ids.map(id=>grandQuestRound(id,1).target))
        await record(Array.from({length:amount},(_,i)=>({id:`q${i}`,instanceId:`q${i}:0`})))
        await record(Array.from({length:amount},(_,i)=>({id:`q${i}`,instanceId:`q${i}:0`})))
        for(const id of ids){const circle=await db.collection('circles').doc(id).get();assert.equal(circle.data().totalElo,200);const goal=await circle.ref.collection('goals').doc('grandQuest').get();assert.equal(goal.data().count,amount);assert.deepEqual((await circle.ref.collection('grandQuestRounds').doc('1').get()).data().eligible.sort(),[id===ids[0]?uids[0]:uids[1]])}
        const {saveRealtimeResult}=await import('../realtime/realtimeService.js')
        const {computeTotalElo}=await import('../leaderboards/leaderboardService.js')
        const result={gameId:prefix,modeId:'sat-classic',ranked:true,playerIds:uids.slice(0,2),winnerUserId:uids[0],roundsPlayed:2,endReason:'max_questions',participationByUserId:{[uids[0]]:2,[uids[1]]:2},startedAt:Date.now()-120000,endedAt:Date.now()}
        await saveRealtimeResult(result)
        const stats=await Promise.all(uids.slice(0,2).map(uid=>db.collection('userStats').doc(uid).get()))
        const total=stats.reduce((sum,snap)=>sum+computeTotalElo(snap.data().play),0)
        for(const id of ids)assert.equal((await db.collection('circles').doc(id).get()).data().totalElo,total)
        assert.equal((await saveRealtimeResult(result)).duplicate,true)
        for(const id of ids)assert.equal((await db.collection('circles').doc(id).get()).data().totalElo,total)
        await mutateMembership(uids[2],{action:'join',circleId:ids[0]})
        await setPrimaryCircle(uids[2],ids[0]);await assert.rejects(claimCircleGrandQuest(uids[2],ids[0],1),/not available/)
        await assert.rejects(editCircleIdentity(uids[1],ids[0],{flair:'Other'}),/Unauthorized/)
        await assert.rejects(editCircleIdentity(uids[0],ids[0],{flair:'fuck'}),/appropriate/)
        await setPrimaryCircle(uids[0],ids[0])
        const claims=await Promise.all([claimCircleGrandQuest(uids[0],ids[0],1),claimCircleGrandQuest(uids[0],ids[0],1)])
        assert.equal(claims.reduce((sum,r)=>sum+r.reward.xp,0),grandQuestRound(ids[0],1).reward.xp)
        await setPrimaryCircle(uids[0],ids[1]);await assert.rejects(claimCircleGrandQuest(uids[0],ids[1],1),/not available/)
        await mutateMembership(uids[0],{action:'leave',circleId:ids[1]});assert.equal((await db.collection('users').doc(uids[0]).get()).data().primaryCircleId,null)
    }finally{
        await db.collection('gameResults').doc(prefix).delete()
        for(const id of ids)await db.recursiveDelete(db.collection('circles').doc(id))
        for(const uid of uids)await Promise.all(['users','wallets','userStats'].map(c=>db.collection(c).doc(uid).delete()))
    }
})

test('emulator: future event IDs queue and acknowledge independently', {skip:process.env.USE_FIREBASE_EMULATORS!=='true'},async()=>{
    const {db}=await import('../../lib/firebaseAdmin.js')
    const {ONLINE_EVENTS}=await import('./steps.js')
    const {getOnlineEvents,acknowledgeEvent}=await import('./onboardingService.js')
    const uid=`event_qa_${randomUUID()}`,event={id:`update:${randomUUID()}`,type:'update',order:10}
    ONLINE_EVENTS.push(event)
    try {
        assert.deepEqual((await getOnlineEvents(uid)).pending.map(e=>e.id),['onboarding:v1',event.id])
        await acknowledgeEvent(uid,'onboarding:v1')
        assert.deepEqual((await getOnlineEvents(uid)).pending.map(e=>e.id),[event.id])
        await acknowledgeEvent(uid,event.id)
        assert.equal((await getOnlineEvents(uid)).pending.length,0)
    } finally {ONLINE_EVENTS.splice(ONLINE_EVENTS.indexOf(event),1);await db.collection('onboarding').doc(uid).delete()}
})

test('emulator: free crate survives refresh, replay and testing reset', {skip:process.env.USE_FIREBASE_EMULATORS!=='true'},async()=>{
    const {db}=await import('../../lib/firebaseAdmin.js')
    const {getOnlineEvents,startOnboarding,openTutorialCrate,advanceOnboarding,completeOnboarding,resetOnboardingForTesting,reserveArtifact}=await import('./onboardingService.js')
    const uid=`tutorial_crate_${randomUUID()}`,ref=db.collection('onboarding').doc(uid),user=db.collection('users').doc(uid),owned=db.collection('tasks').doc(`${uid}_owned`),unrelated=db.collection('tasks').doc(`${uid}_other`)
    try {
        await user.set({progress:{level:1,xp:0,curveVersion:3}})
        let session=await startOnboarding(uid,'play'),run=session.active
        const crateIndex=session.steps.findIndex(s=>s.event==='tutorial-crate')
        await assert.rejects(openTutorialCrate(uid,{runId:run.id}),/not available/)
        await ref.update({'active.index':crateIndex})
        await assert.rejects(advanceOnboarding(uid,{runId:run.id,index:crateIndex,event:'tutorial-crate'}),/Open your free crate/)
        const reward=await openTutorialCrate(uid,{runId:run.id})
        session=await getOnlineEvents(uid)
        assert.deepEqual(session.active.crateResult,reward)
        assert.deepEqual(await openTutorialCrate(uid,{runId:run.id}),reward)
        // Runs saved after the old final explanation still finish normally.
        await ref.update({'active.index':session.steps.length+1})
        assert.equal((await getOnlineEvents(uid)).active.index,session.steps.length)
        await completeOnboarding(uid,{runId:run.id})
        session=await startOnboarding(uid,'both')
        assert.equal(session.active.freeCrateIncluded,false)
        assert.equal(session.steps.find(s=>s.id==='lumen').kind,'info')
        await ref.update({'active.index':crateIndex})
        await assert.rejects(openTutorialCrate(uid,{runId:session.active.id}),/not available/)
        await ref.update({'active.index':session.steps.findIndex(s=>s.event==='task-one')})
        await reserveArtifact(uid,{runId:session.active.id,kind:'task-one',recordId:owned.id})
        await owned.set({userId:uid,tutorialRunId:session.active.id})
        await unrelated.set({userId:uid,title:'Keep me'})
        await ref.update({acknowledged:['onboarding:v1','update:seen']})
        const reset=await resetOnboardingForTesting(uid)
        assert.equal(reset.pending[0].id,'onboarding:v1')
        assert.deepEqual(reset.rewarded,[])
        assert.deepEqual(reset.acknowledged,['update:seen'])
        assert.equal((await owned.get()).exists,false)
        assert.equal((await unrelated.get()).exists,true)
        assert.ok((await db.collection('wallets').doc(uid).get()).data().inventory.includes(reward.color.id))
        session=await startOnboarding(uid,'play')
        assert.equal(session.active.freeCrateIncluded,true)
    } finally {await Promise.all([ref.delete(),user.delete(),owned.delete(),unrelated.delete(),db.collection('wallets').doc(uid).delete()])}
})
