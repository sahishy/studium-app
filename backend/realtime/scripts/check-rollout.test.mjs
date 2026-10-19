import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const check = (fields = {}, cohort = '10') => {
    const directory = mkdtempSync(join(tmpdir(), 'studium-rollout-'))
    try {
        const filename = join(directory, 'report.json')
        writeFileSync(filename, JSON.stringify({ environment: 'https://staging.example.test', completedMatches: 100,
            transportErrors: 0, p95ProcessingMs: 1, p95UpdateMs: 140, p95RttMs: 100,
            browserAcceptancePassed: true, productionBaselineCompared: true, ...fields }))
        return spawnSync(process.execPath, [fileURLToPath(new URL('./check-rollout.mjs', import.meta.url)), filename, cohort], { encoding: 'utf8' })
    } finally { rmSync(directory, { recursive: true, force: true }) }
}
test('first cohort requires measured baseline and browser acceptance', () => {
    assert.equal(check().status, 0)
    assert.match(check({ productionBaselineCompared: false }).stderr, /production baseline/)
    assert.equal(check({ browserAcceptancePassed: false }).status, 1)
})
test('cloud feedback, processing and settled-match targets are required', () => {
    for(const fields of [{ environment: 'http://localhost' }, { completedMatches: 99 }, { transportErrors: 1 },
        { p95ProcessingMs: 20 }, { p95UpdateMs: 176 }, { p95UpdateMs: null }]) assert.equal(check(fields).status, 1)
})
test('expansion requires the previous real cohort and stable settlement/error rates', () => {
    assert.equal(check({}, '50').status, 1)
    assert.equal(check({ cohortPercent: 10, settlementAndErrorRatesStable: true }, '50').status, 0)
    assert.equal(check({ cohortPercent: 10, settlementAndErrorRatesStable: true }, '100').status, 1)
    assert.equal(check({ cohortPercent: 50, settlementAndErrorRatesStable: true }, '100').status, 0)
})
