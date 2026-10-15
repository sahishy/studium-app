import test from 'node:test'
import assert from 'node:assert/strict'
import { BlendFunction } from 'postprocessing'
import { configureCrateBloom, createCrateBloomCoverage } from './crateBloom.js'

test('bloom adds HDR color without amplifying coverage', () => {
    let shader
    configureCrateBloom({ setFragmentShader: (value) => { shader = value } })
    assert.match(shader, /vec4\(tint \* peak \* intensity, 0\.0\)/)
    assert.doesNotMatch(shader, /texture2D\(map, uv\) \* intensity/)
    assert.doesNotThrow(() => configureCrateBloom(null))
})

test('halo tint follows the bright core hue with a subtle white lift, retaining its falloff', () => {
    let shader
    configureCrateBloom({ setFragmentShader: (value) => { shader = value } })
    assert.match(shader, /halo \/ max\(peak, 0\.00001\)/)
    assert.match(shader, /coreTint \/= 0\.75/)
    assert.match(shader, /mix\(coreTint, vec3\(1\.0\), 0\.12\)/)
    assert.match(shader, /mix\(hue, tint, 1\.0 - clamp\(inputColor\.a, 0\.0, 1\.0\)\)/)
    // White stays white; colored rarities lighten without raising peak energy.
    for(const hue of [[1,1,1], [1,0.25,0], [0.22,0,1]]) {
        const tint = hue.map(channel => ((channel * 3 / (1 + channel * 3)) / 0.75) * 0.88 + 0.12)
        assert.equal(Math.max(...tint), 1)
        tint.forEach((channel, index) => assert.ok(channel >= hue[index] && channel <= 1))
    }
})

test('final coverage preserves opaque surfaces and accounts for display-space halo color', () => {
    const effect = createCrateBloomCoverage()
    assert.equal(effect.blendMode.blendFunction, BlendFunction.SRC)
    const shader = effect.getFragmentShader()
    assert.match(shader, /outputColor = inputColor/)
    assert.match(shader, /1\.0 \/ 2\.4/)
    assert.match(shader, /max\(inputColor\.a, clamp\(coverage, 0\.0, 1\.0\)\)/)
    effect.dispose()
})
