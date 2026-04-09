import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { SkeletonUtils } from 'three-stdlib'

import characterModelUrl from '../assets/models/character.glb'
import { AVATAR_COLORS, AVATAR_FACES } from '../utils/avatarUtils'

const AVATAR_THUMBNAIL_SIZE = 128
const AVATAR_THUMBNAIL_BACKGROUND = '#E5E7EB'
const AVATAR_DEFAULT_COLOR = AVATAR_COLORS[2];
const AVATAR_THUMBNAIL_ANIMATION_NAME = 'Idle'

const cameraPosition = new THREE.Vector3(0, 1, 4)
const cameraLookAt = new THREE.Vector3(0, 0.8, 0)

// avoid transition from t-pose to idle
const normalizeClipStartToZero = (clip) => {

    if(!clip?.tracks?.length) return clip

    let shiftTime = Infinity

    clip.tracks.forEach((track) => {
        if (track?.times?.length) {
            const nextTime = Array.from(track.times).find((time) => time > 0)
            if (typeof nextTime === 'number') {
                shiftTime = Math.min(shiftTime, nextTime)
            }
        }
    })

    if(!Number.isFinite(shiftTime) || shiftTime <= 0) {
        return clip
    }

    const shiftedClip = clip.clone()
    shiftedClip.tracks.forEach((track) => {
        if (!track?.times?.length) return

        const valueSize = track.getValueSize()
        const interpolant = track.createInterpolant(new track.ValueBufferType(valueSize))
        const sampledAtShift = interpolant.evaluate(shiftTime)

        const nextTimes = [0]
        const nextValues = [...Array.from(sampledAtShift)]

        let firstIndexAtOrAfterShift = -1
        for (let i = 0; i < track.times.length; i++) {
            if (track.times[i] >= shiftTime) {
                firstIndexAtOrAfterShift = i
                break
            }
        }

        const startIndex = firstIndexAtOrAfterShift >= 0
            ? firstIndexAtOrAfterShift + 1
            : track.times.length

        for (let i = startIndex; i < track.times.length; i++) {
            nextTimes.push(track.times[i] - shiftTime)

            const valueOffset = i * valueSize
            for (let j = 0; j < valueSize; j++) {
                nextValues.push(track.values[valueOffset + j])
            }
        }

        const TimesCtor = track.times.constructor
        const ValuesCtor = track.values.constructor
        track.times = new TimesCtor(nextTimes)
        track.values = new ValuesCtor(nextValues)
    })

    shiftedClip.resetDuration()
    return shiftedClip

}

const generateAvatarThumbnailBlob = async (profile) => {

    const avatar = profile?.profile?.avatar || profile?.avatar || {}
    const selectedFace = avatar?.face ?? 0
    const selectedColor = avatar?.color || AVATAR_DEFAULT_COLOR

    const canvas = document.createElement('canvas')
    const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
        preserveDrawingBuffer: true,
    })

    renderer.setSize(AVATAR_THUMBNAIL_SIZE, AVATAR_THUMBNAIL_SIZE, false)
    renderer.setPixelRatio(1)
    renderer.setClearColor(AVATAR_THUMBNAIL_BACKGROUND, 1)

    const scene = new THREE.Scene()

    const camera = new THREE.PerspectiveCamera(20, 1, 0.1, 100)
    camera.position.copy(cameraPosition)
    camera.lookAt(cameraLookAt)

    const ambientLight = new THREE.AmbientLight(0xffffff, 1)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5)
    directionalLight.position.set(0, 1, 1)

    scene.add(ambientLight)
    scene.add(directionalLight)

    const gltfLoader = new GLTFLoader()
    const textureLoader = new THREE.TextureLoader()

    try {
        const [gltf, faceTexture] = await Promise.all([
            gltfLoader.loadAsync(characterModelUrl),
            textureLoader.loadAsync(AVATAR_FACES[selectedFace] || AVATAR_FACES[0]),
        ])

        faceTexture.flipY = false
        faceTexture.needsUpdate = true

        const clonedScene = SkeletonUtils.clone(gltf.scene)

        clonedScene.traverse((obj) => {
            if (!obj.isMesh) return

            const materials = Array.isArray(obj.material) ? obj.material : [obj.material]

            const nextMaterials = materials.map((mat) => {
                if (!mat) return mat

                if (mat.name === 'body') {
                    const bodyMat = new THREE.MeshToonMaterial({ color: selectedColor })
                    bodyMat.name = 'body'
                    return bodyMat
                }

                if (mat.name === 'face') {
                    const faceMat = new THREE.MeshBasicMaterial({
                        map: faceTexture,
                        transparent: true,
                        alphaTest: 0.5,
                    })
                    faceMat.name = 'face'
                    return faceMat
                }

                return mat
            })

            obj.material = nextMaterials.length === 1 ? nextMaterials[0] : nextMaterials
        })

        clonedScene.position.set(0, -1, 0)
        scene.add(clonedScene)

        const idleClip = (gltf.animations || []).find((clip) => clip?.name === AVATAR_THUMBNAIL_ANIMATION_NAME)
            || (gltf.animations || []).find((clip) => clip?.name?.toLowerCase() === AVATAR_THUMBNAIL_ANIMATION_NAME.toLowerCase())

        let mixer = null
        if (idleClip) {

            const thumbnailClip = normalizeClipStartToZero(idleClip)
            mixer = new THREE.AnimationMixer(clonedScene)
            const idleAction = mixer.clipAction(thumbnailClip)

            idleAction.reset()
            idleAction.enabled = true
            idleAction.clampWhenFinished = true
            idleAction.setLoop(THREE.LoopOnce, 1)
            idleAction.setEffectiveWeight(1)
            idleAction.setEffectiveTimeScale(1)
            idleAction.play()

            mixer.setTime(0.5)

            clonedScene.updateMatrixWorld(true)

        }

        renderer.render(scene, camera)

        const blob = await new Promise((resolve, reject) => {
            canvas.toBlob((value) => {
                if (value) {
                    resolve(value)
                } else {
                    reject(new Error('Failed to generate avatar thumbnail blob.'))
                }
            }, 'image/jpeg')
        })

        return blob
    } finally {
        scene.traverse((obj) => {
            if (!obj.isMesh) return

            const materials = Array.isArray(obj.material) ? obj.material : [obj.material]
            materials.forEach((material) => {
                if (!material) return
                if (material.map) material.map.dispose()
                material.dispose?.()
            })

            obj.geometry?.dispose?.()
        })

        renderer.dispose()
    }

}

export {
    AVATAR_THUMBNAIL_SIZE,
    AVATAR_THUMBNAIL_BACKGROUND,
    generateAvatarThumbnailBlob,
}
