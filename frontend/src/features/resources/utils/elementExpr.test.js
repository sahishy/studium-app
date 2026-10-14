import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

// The renderer and the server validator must agree exactly, or an author could preview an
// element that publishing then rejects. Functions deploys only backend/functions, so the
// file is copied rather than imported, and this test is what keeps the copy honest.
const read = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')

const canonical = (name) => read(`../../../../../backend/functions/src/features/resources/${name}`)

test('the shared element modules match their canonical backend copies', () => {
    assert.equal(read('./elementExpr.js'), canonical('elementExpr.js'))
    assert.equal(read('./elementModel.js'), canonical('elementModel.js'))
})
