import { Buffer } from 'node:buffer'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { featuredCourses } from './featuredCourses.js'
const courses=JSON.parse(await readFile(new URL('../../../data/courses.json',import.meta.url)))
test('Daily selection is stable, distinct, and independent of catalog input order',()=>{
    const day=new Date('2026-10-12T00:01:00Z'),later=new Date('2026-10-12T23:59:59Z')
    const first=featuredCourses(courses,day)
    assert.equal(first.length,3)
    assert.equal(new Set(first.map(c=>c.courseId)).size,3)
    assert.deepEqual(first,featuredCourses([...courses].reverse(),later))
    assert.notDeepEqual(first,featuredCourses(courses,new Date('2026-10-13T00:00:00Z')))
    assert.equal(featuredCourses([]).length,0)
})
test('Both tutorial task examples parse with a date and APUSH resolves to the catalog course',async()=>{
    const source=await readFile(new URL('../../agenda/utils/naturalLanguage.jsx',import.meta.url),'utf8')
    const {parseTextToTaskTitle,extractTaskTitleMetadata}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
    const first=parseTextToTaskTitle('Finish homework tomorrow')
    assert.ok(extractTaskTitleMetadata(first.title).dueDate)
    assert.equal(extractTaskTitleMetadata(first.title).dueTime,'')
    const second=parseTextToTaskTitle('apush test tomorrow',{courses:[courses.find(c=>c.courseId==='LCPS-750100')]})
    assert.equal(extractTaskTitleMetadata(second.title).courseId,'LCPS-750100')
    assert.ok(extractTaskTitleMetadata(second.title).dueDate)
})
