import assert from 'node:assert/strict'
import test from 'node:test'
import { publicCollegePost, validateCollegePost, validateResource, validExternalUrl } from './contentService.js'

test('links and lesson blocks accept safe bounded data and reject executable URLs', () => {
    assert.equal(validExternalUrl('javascript:alert(1)'), null)
    assert.throws(() => validateResource({ type: 'link', title: 'Bad', status: 'published', linkType: 'website', url: 'javascript:alert(1)' }))
    assert.equal(validateResource({ type: 'link', title: 'Draft', status: 'draft', linkType: 'website', url: '' }).url, '')
    const graph = { id: 'g', type: 'graph', curves: [{ id: 's', slope: 1, intercept: 10 }], sliders: [{ id: 'shift', curveId: 's', field: 'intercept', min: 0, max: 50 }] }
    assert.equal(validateResource({ type: 'lesson', title: 'Supply', status: 'published', blocks: [graph] }).blocks[0].curves[0].slope, 1)
    assert.throws(() => validateResource({ type: 'lesson', title: 'Bad', status: 'published', blocks: [{ ...graph, sliders: [{ curveId: 'missing', min: 0, max: 50 }] }] }))
})

test('college posts are anonymous by default and only include explicitly entered statistics', () => {
    const validated = validateCollegePost({ college: 'Example', year: 2026, outcome: 'accepted' })
    const publicPost = publicCollegePost({ id: 'post', data: () => ({ ...validated, ownerId: 'student' }) }, 'other')
    assert.equal(publicPost.attributed, false)
    assert.equal(publicPost.ownerId, undefined)
    assert.equal(publicPost.sat, null)
    assert.throws(() => validateCollegePost({ college: 'Example', year: 2026, outcome: 'accepted', sat: 9999 }))
})
