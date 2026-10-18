import assert from 'node:assert/strict'
import test from 'node:test'
import { publicCollegePost, validateCollegePost, validateResource, validExternalUrl } from './contentService.js'

test('links and lesson blocks accept safe bounded data and reject executable URLs', () => {
    assert.equal(validExternalUrl('javascript:alert(1)'), null)
    assert.throws(() => validateResource({ type: 'link', title: 'Bad', status: 'published', linkType: 'website', url: 'javascript:alert(1)' }))
    assert.equal(validateResource({ type: 'link', title: 'Draft', status: 'draft', linkType: 'website', url: '' }).url, '')
    const element = {
        id: 'e', type: 'interactive', title: 'Supply', canvas: { xMin: 0, xMax: 100, yMin: 0, yMax: 100 },
        params: [{ id: 'shift', label: 'Shift', control: 'slider', min: 0, max: 50, step: 1, value: 10 }],
        shapes: [{ id: 'supply', kind: 'curve', x: ['var', 'u'], y: ['op', '+', ['var', 'u'], ['param', 'shift']], domain: [['num', 0], ['num', 100]] }],
    }
    const page = (blocks) => ({ type: 'lesson', title: 'Supply', status: 'published', pages: [{ id: 'p1', blocks }] })
    assert.equal(validateResource(page([element])).pages[0].blocks[0].params[0].max, 50)
    assert.throws(() => validateResource(page([{ ...element, shapes: [{ ...element.shapes[0], y: ['param', 'missing'] }] }])))
    assert.throws(() => validateResource(page([{ id: 'g', type: 'graph', curves: [{ id: 's', slope: 1, intercept: 10 }] }])), /Unsupported lesson block/)
    assert.throws(() => validateResource({ type: 'lesson', title: 'Empty', status: 'published', pages: [{ id: 'p1', blocks: [] }] }), /Add something to a page/)
    assert.throws(() => validateResource({ type: 'course', title: 'Gone', status: 'draft' }), /Choose a resource type/)
})

test('college posts are anonymous by default and only include explicitly entered statistics', () => {
    const validated = validateCollegePost({ college: 'Example', year: 2026, outcome: 'accepted' })
    const publicPost = publicCollegePost({ id: 'post', data: () => ({ ...validated, ownerId: 'student' }) }, 'other')
    assert.equal(publicPost.attributed, false)
    assert.equal(publicPost.ownerId, undefined)
    assert.equal(publicPost.sat, null)
    assert.throws(() => validateCollegePost({ college: 'Example', year: 2026, outcome: 'accepted', sat: 9999 }))
})

test('every block carries a frame on its page, clamped to stay inside it', () => {
    const lesson = validateResource({
        type: 'lesson', title: 'Placed', status: 'draft',
        pages: [{ id: 'p1', blocks: [
            { id: 'a', type: 'text', text: 'Hi', frame: { x: 10, y: 20, w: 30, h: 25 } },
            { id: 'b', type: 'text', text: 'Off the edge', frame: { x: 95, y: 95, w: 40, h: 40 } },
            { id: 'c', type: 'text', text: 'No frame given' },
        ] }],
    })
    const [placed, clamped, fallback] = lesson.pages[0].blocks
    assert.deepEqual(placed.frame, { x: 10, y: 20, w: 30, h: 25 })
    // Nothing may hang off the page, so the position gives way to the size.
    assert.deepEqual(clamped.frame, { x: 60, y: 60, w: 40, h: 40 })
    assert.equal(fallback.frame.w > 0 && fallback.frame.h > 0, true)
})


test('resource links add HTTP when the protocol is omitted and still reject invalid URLs', () => {
    const link = { type: 'link', title: 'Reference', status: 'published', linkType: 'website' }
    assert.equal(validateResource({ ...link, url: ' example.com/calculus?q=prep ' }).url, 'http://example.com/calculus?q=prep')
    assert.equal(validateResource({ ...link, url: 'https://example.com/video' }).url, 'https://example.com/video')
    assert.throws(() => validateResource({ ...link, url: 'not a valid link' }), /valid URL/)
    assert.throws(() => validateResource({ ...link, url: 'javascript:alert(1)' }), /valid URL/)
    assert.throws(() => validateResource({ ...link, url: 'ftp://example.com' }), /valid URL/)
})
