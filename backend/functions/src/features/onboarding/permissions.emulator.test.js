import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

test('emulator rules: server-owned state, moderated identity, and cleanup ownership are protected', {skip:process.env.USE_FIREBASE_EMULATORS!=='true'}, async()=>{
    const { db, auth } = await import('../../lib/firebaseAdmin.js')
    const session=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=emulator',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:`rules_${randomUUID()}@example.test`,password:'EmulatorQA2026!',returnSecureToken:true})}).then(r=>r.json())
    const uid=session.localId, token=session.idToken, id=`rules_${uid}`
    const write=async(path,fields)=>fetch(`http://127.0.0.1:8080/v1/projects/studium-io/databases/(default)/documents/${path}`,{method:'PATCH',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({fields})})
    const str=stringValue=>({stringValue}), number=integerValue=>({integerValue:String(integerValue)})
    try{
        await db.collection('users').doc(uid).set({profile:{avatar:{}},progress:{level:1,xp:0},primaryCircleId:null})
        await db.collection('circles').doc(id).set({createdByUserId:uid,profile:{title:'QA',flair:''}})
        await db.collection('onboarding').doc(uid).set({active:{id:'run',artifacts:{'task-one':id}}})
        for(const path of [`onboarding/${uid}`,`circlePayouts/${id}`,`circles/${id}/weeks/current`,`circles/${id}/activity/fake`,`schoolTeachers/${id}`])assert.equal((await write(path,{count:number(100)})).status,403,path)
        assert.equal((await write(`circles/${id}`,{createdByUserId:str(uid),profile:{mapValue:{fields:{title:str('Bypass'),flair:str('unmoderated')}}}})).status,403)
        assert.equal((await write(`courses/${id}`,{studentId:str(uid),teacherId:str('retired')})).status,403)
        assert.equal((await write(`courseReviews/${id}`,{userId:str(uid),day:str('A')})).status,403)
        const fields={userId:str(uid),status:str('Incomplete'),alreadyCompleted:{booleanValue:false},tutorialRunId:str('run'),tutorialKind:str('task-one')}
        assert.equal((await write(`tasks/${id}_wrong`,fields)).status,403)
        assert.equal((await write(`tasks/${id}`,fields)).status,200)
        const {tutorialRunId,tutorialKind,...unmarked}=fields
        assert.equal((await write(`tasks/${id}`,unmarked)).status,403)
        assert.equal((await write(`users/${uid}`,{profile:{mapValue:{fields:{avatar:{mapValue:{fields:{}}}}}},progress:{mapValue:{fields:{level:number(1),xp:number(0)}}},primaryCircleId:str(id)})).status,403)
    }finally{
        await Promise.all([db.collection('users').doc(uid).delete(),db.collection('onboarding').doc(uid).delete(),db.collection('tasks').doc(id).delete(),db.collection('courses').doc(id).delete(),db.collection('courseReviews').doc(id).delete(),db.recursiveDelete(db.collection('circles').doc(id)),auth.deleteUser(uid)])
    }
})
