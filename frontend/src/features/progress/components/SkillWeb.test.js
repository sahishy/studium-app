import assert from 'node:assert/strict'
import test, { before, after } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

let server
let SkillWeb
before(async () => {
    server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' })
    SkillWeb = (await server.ssrLoadModule('/src/features/progress/components/SkillWeb.jsx')).default
})
after(async () => { await server?.close() })

const board = (accuracy) => ({ answered: 10, domains: [{ id: 'Algebra', answered: 10, accuracy }] })

test('loading shows the shared indicator without presenting default mastery scores', () => {
    const html = renderToStaticMarkup(createElement(SkillWeb, { loading: true }))
    assert.ok(html.includes('aria-busy="true"'))
    assert.ok(html.includes('role="status"'))
    assert.ok(html.includes('aria-label="Loading"'))
    assert.ok(!html.includes('Mastery scores by SAT domain'))
    assert.ok(!html.includes('mastery'))
})

test('the Progress graph keeps its single shape when no comparison board is supplied', () => {
    const html = renderToStaticMarkup(createElement(SkillWeb, { board: board(0.7) }))
    assert.ok(!html.includes('stroke-dasharray'))
    assert.ok(!html.includes('Before match'))
    assert.ok(html.includes('Algebra 70'))
})

test('a comparison board adds a faded dashed shape without a visible legend', () => {
    const html = renderToStaticMarkup(createElement(SkillWeb, { board: board(0.7), comparisonBoard: board(0.5) }))
    assert.ok(html.includes('stroke-dasharray="4 3"'))
    assert.ok(html.includes('stroke-opacity="0.4"'))
    assert.ok(!html.includes('After match'))
    assert.ok(!html.includes('>Before match<'))
    assert.ok(html.includes('Algebra 70'))
    assert.ok(html.includes('Algebra 50'))
})
