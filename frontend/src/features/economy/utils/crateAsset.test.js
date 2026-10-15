import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { AnimationMixer, LoopOnce, Texture } from 'three'
import { BURST_FLASH_SECONDS, CLIP_SECONDS } from './crateInteraction.js'

// Node has no image decoder; browser rendering verifies the actual atlas pixels.
const createHeadlessLoader = () => new GLTFLoader().register(() => ({
    name: 'headless-textures',
    loadTexture: () => Promise.resolve(new Texture()),
}))

test('exported crate preserves Locker idle and includes the interactive drop clips without top glow meshes', async () => {
    const bytes = await readFile(new URL('../../../assets/models/loot-crate.glb', import.meta.url))
    const { scene, animations } = await createHeadlessLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
    assert.deepEqual(animations.map((clip) => clip.name).sort(), ['Hit_Back', 'Hit_Left', 'Hit_Right', 'Idle', 'RevealBurst', 'Upgrade', 'WaitingIdle'])
    const root = scene.getObjectByName('StudiumLayeredCrate')
    const layers = ['Layer_Bottom', 'Layer_Middle', 'Layer_Top'].map((name) => scene.getObjectByName(name))
    const mixer = new AnimationMixer(scene)
    const idle = animations.find((clip) => clip.name === 'Idle')
    mixer.clipAction(idle).play()
    mixer.setTime(0)
    assert.ok(Math.abs(root.position.y) < 0.001)
    const rest = layers.map((layer) => layer.position.y)
    mixer.setTime(59 / 24)
    assert.ok(root.position.y > 0.1, 'Idle includes a whole-crate hop')
    assert.ok(layers.some((layer, index) => layer.position.y > rest[index] + 0.01), 'Layers move loosely during the hop')
    mixer.setTime(idle.duration - 1 / 24)
    assert.ok(Math.abs(root.position.y) < 0.001, 'Idle finishes in the resting pose')
    mixer.stopAllAction()
    const waiting = animations.find((clip) => clip.name === 'WaitingIdle')
    mixer.clipAction(waiting).play()
    mixer.setTime(2.5)
    assert.ok(root.position.y > 0.15, 'Purchased idle floats above the resting pose')
    assert.ok(layers.some((layer, index) => Math.abs(layer.position.y - rest[index]) > 0.01))
    mixer.stopAllAction()
    for(const name of ['Hit_Left', 'Hit_Right', 'Hit_Back', 'Upgrade']) {
        const clip = animations.find((clip) => clip.name === name)
        assert.ok(Math.abs(clip.duration - CLIP_SECONDS[name]) < 0.001, `${name} matches the interaction timer`)
        const action = mixer.clipAction(clip)
        action.reset().setLoop(LoopOnce, 1); action.clampWhenFinished = true; action.play()
        mixer.setTime((name === 'Upgrade' ? 4 : 2) / 24)
        assert.ok(root.scale.y < 0.98, `${name} squashes before popping up`)
        if(name === 'Upgrade') {
            let turn = 0
            let previous = root.quaternion.clone()
            for(let time = 3 / 24; time <= clip.duration; time += 1 / 24) {
                mixer.setTime(time)
                turn += previous.angleTo(root.quaternion)
                previous.copy(root.quaternion)
            }
            assert.ok(turn > 6, 'Upgrade performs a full, lively 360-degree spin')
        }
        mixer.setTime(clip.duration + 0.01)
        assert.ok(root.position.length() < 0.001, `${name} returns to rest`)
        assert.ok(Math.abs(root.scale.y - 1) < 0.001)
        assert.ok(Math.abs(root.quaternion.w) > 0.999)
        layers.forEach((layer, index) => {
            assert.ok(Math.abs(layer.position.y - rest[index]) < 0.001, `${name} settles every layer`)
            assert.ok(Math.abs(layer.quaternion.w) > 0.999)
        })
        mixer.stopAllAction()
    }
    const burst = animations.find((clip) => clip.name === 'RevealBurst')
    assert.ok(Math.abs(burst.duration - CLIP_SECONDS.RevealBurst) < 0.001)
    const action = mixer.clipAction(burst)
    action.reset().setLoop(LoopOnce, 1); action.clampWhenFinished = true; action.play()
    mixer.setTime(15 / 24)
    assert.ok(root.scale.y < 0.95, 'Finale compresses while building energy')
    assert.ok(Math.abs(root.quaternion.x) + Math.abs(root.quaternion.z) > 0.005, 'Charge has lively jitter')
    mixer.setTime(BURST_FLASH_SECONDS)
    assert.ok(root.scale.y > 0.95, 'Flash cue coincides with the start of the sudden expansion')
    mixer.setTime(19 / 24)
    assert.ok(root.scale.y > 1.25, 'Burst pops quickly to a larger size')
    assert.ok(layers[2].position.y > rest[2] + 0.7, 'Top layer bursts away from the core')
    assert.ok(layers[0].position.y < rest[0] - 0.2, 'Bottom layer separates in the opposite direction')
    for(const name of ['Top_Glow_Plume_0', 'Top_Glow_Plume_1', 'Top_Emission_Source']) assert.equal(scene.getObjectByName(name), undefined)
    mixer.stopAllAction(); mixer.uncacheRoot(scene)
})

test('crate embeds a shared 2048 UV atlas and gives only the middle layer the cloth material', async () => {
    const bytes = await readFile(new URL('../../../assets/models/loot-crate.glb', import.meta.url))
    const jsonLength = bytes.readUInt32LE(12)
    const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString())
    const materialFor = (name) => {
        const node = gltf.nodes.find((node) => node.name === name)
        const primitive = gltf.meshes[node.mesh].primitives[0]
        assert.notEqual(primitive.attributes.TEXCOORD_0, undefined)
        return gltf.materials[primitive.material]
    }
    const middle = materialFor('Layer_Middle')
    assert.equal(middle.name, 'Crate_Cloth_Lumen_Blue')
    assert.ok(middle.pbrMetallicRoughness.roughnessFactor >= 0.9)
    const textureIndex = middle.pbrMetallicRoughness.baseColorTexture.index
    const atlasSource = gltf.textures[textureIndex].source
    for(const name of ['Core_Cube', 'Layer_Bottom', 'Layer_Top']) {
        const material = materialFor(name)
        assert.equal(material.name, 'Crate_Gray_With_Cloth_Atlas')
        assert.equal(gltf.textures[material.pbrMetallicRoughness.baseColorTexture.index].source, atlasSource)
    }
    const image = gltf.images[gltf.textures[textureIndex].source]
    assert.equal(image.mimeType, 'image/png')
    const view = gltf.bufferViews[image.bufferView]
    const imageStart = 28 + jsonLength + (view.byteOffset || 0)
    assert.equal(bytes.readUInt32BE(imageStart + 16), 2048)
    assert.equal(bytes.readUInt32BE(imageStart + 20), 2048)
})
