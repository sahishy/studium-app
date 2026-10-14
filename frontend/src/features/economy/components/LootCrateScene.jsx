import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { EffectComposer, SelectiveBloom, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { Component, Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import crateUrl from '../../../assets/models/loot-crate.glb'
import { RARITY_GLOW_COLORS } from '../utils/crateSequence'
import { createCrateCoreGlowMaterial, createCrateSurfaceMaterial, updateCrateCoreGlow } from '../utils/crateMaterials'
import { getCrateAnimationName } from '../utils/crateAnimation'
import { configureCrateBloom, createCrateBloomCoverage } from '../utils/crateBloom'

const CrateModel = ({ interactive, rarity, rarityTransition, motion, idleEnabled, onReady }) => {
    const { scene, animations } = useGLTF(crateUrl)
    const light = useRef()
    const previousAction = useRef(null)
    const bloomCoverage = useMemo(createCrateBloomCoverage, [])
    useEffect(() => () => bloomCoverage.dispose(), [bloomCoverage])
    const rig = useMemo(() => {
        const clone = scene.clone(true)
        // The interior core emits light; remove all top-only glow geometry.
        clone.getObjectByName('Top_Glow_Plume_0')?.removeFromParent()
        clone.getObjectByName('Top_Glow_Plume_1')?.removeFromParent()
        clone.getObjectByName('Top_Emission_Source')?.removeFromParent()
        const materials = new Set()
        clone.traverse((object) => {
            if(!object.isMesh) return
            const original = object.material
            const material = createCrateSurfaceMaterial(original)
            material.name = original.name
            object.material = material
            materials.add(material)
        })
        const core = clone.getObjectByName('Core_Cube')
        const coreGlowMaterial = createCrateCoreGlowMaterial(core.material)
        coreGlowMaterial.name = 'Core_Rarity_Emission'
        materials.add(coreGlowMaterial)
        core.material = coreGlowMaterial
        const mixer = new THREE.AnimationMixer(clone)
        return { clone, core, coreGlowMaterial, mixer, materials, glowColor: new THREE.Color('#ffffff'), targetColor: new THREE.Color(), transitionFromColor: new THREE.Color('#ffffff'), transitionId: null }
    }, [scene])

    useEffect(() => { onReady?.() }, [onReady])
    useLayoutEffect(() => {
        const name = getCrateAnimationName(interactive, motion)
        const clip = animations.find((clip) => clip.name === name)
        if(!interactive && !idleEnabled) {
            rig.mixer.stopAllAction()
            previousAction.current = null
            return
        }
        if(clip) {
            // Returning to the tab must not briefly show the exploded finale pose.
            if(!interactive) {
                rig.mixer.stopAllAction()
                previousAction.current = null
            }
            const action = rig.mixer.clipAction(clip)
            const idle = clip.name === 'Idle' || clip.name === 'WaitingIdle'
            action.reset()
            action.setLoop(idle ? THREE.LoopRepeat : THREE.LoopOnce, idle ? Infinity : 1)
            action.clampWhenFinished = !idle
            action.enabled = true
            action.setEffectiveWeight(1)
            action.setEffectiveTimeScale(interactive ? motion?.timeScale ?? 1 : 1)
            action.play()
            // Stop older fades so interrupted, rapid hits never stack ghost actions.
            rig.mixer.existingAction(clip)?.stopFading()
            animations.forEach((other) => {
                const old = rig.mixer.existingAction(other)
                if(old && old !== action && old !== previousAction.current) old.stop()
            })
            if(previousAction.current && previousAction.current !== action) previousAction.current.crossFadeTo(action, 0.08, false)
            previousAction.current = action
            // Apply the neutral idle pose before the canvas can fade back into view.
            if(!interactive) rig.mixer.update(0)
        }
    }, [rig, animations, interactive, motion, idleEnabled])

    useEffect(() => {
        return () => {
            rig.mixer.stopAllAction()
            rig.mixer.uncacheRoot(rig.clone)
            rig.materials.forEach((material) => material.dispose())
        }
    }, [rig])

    useFrame((_, delta) => {
        if(interactive || idleEnabled) rig.mixer.update(Math.min(delta, 0.1))
        const target = rig.targetColor.set(interactive ? RARITY_GLOW_COLORS[rarity] ?? RARITY_GLOW_COLORS.Common : '#ffffff')
        const color = rig.glowColor
        if(interactive && rarityTransition) {
            if(rig.transitionId !== rarityTransition.startedAt) {
                rig.transitionFromColor.copy(color)
                rig.transitionId = rarityTransition.startedAt
            }
            const progress = Math.min(1, Math.max(0, (performance.now() - rarityTransition.startedAt) / 320))
            const blend = progress * progress * (3 - 2 * progress)
            color.copy(rig.transitionFromColor).lerp(target, blend)
        } else color.copy(target)
        const intensity = interactive && motion?.clip === 'Upgrade' ? 3.5 : 3
        updateCrateCoreGlow(rig.core, rig.coreGlowMaterial, color, intensity)
        if(light.current) {
            light.current.color.set(color)
            light.current.intensity = intensity * 0.18
        }
    })

    return <group position={[0, -1.5, 0]}>
        <primitive object={rig.clone} />
        <pointLight ref={light} position={[0, 1.7, 0]} distance={4} decay={2} />
        <EffectComposer multisampling={2}>
            <SelectiveBloom ref={configureCrateBloom} selection={[rig.core]} lights={[light]} ignoreBackground mipmapBlur
                luminanceThreshold={0.1} luminanceSmoothing={0.1} intensity={8} radius={0.55} levels={6} />
            {/* Reinhard preserves saturated glow channels instead of ACES whitening them. */}
            <ToneMapping mode={ToneMappingMode.REINHARD} />
            <primitive object={bloomCoverage} />
        </EffectComposer>
    </group>
}

class CrateErrorBoundary extends Component {
    state = { failed: false }
    static getDerivedStateFromError() { return { failed: true } }
    render() { return this.state.failed ? this.props.fallback : this.props.children }
}

const CrateFallback = ({ onReady }) => {
    useEffect(() => { onReady?.() }, [onReady])
    return <div className='flex h-full items-center justify-center' aria-label='Crate'>
        <div className='flex w-28 flex-col gap-1'>
            {[0, 1, 2].map((layer) => <div key={layer} className='h-9 rounded-lg border border-white/20 bg-zinc-500 shadow-lg' />)}
        </div>
    </div>
}

const LootCrateScene = ({ interactive = false, rarity = 'Common', rarityTransition = null, motion = null, idleEnabled = true, onReady, viewportScale = 1 }) => (
    <CrateErrorBoundary fallback={<CrateFallback onReady={onReady} />}>
        <Canvas style={{ pointerEvents: 'none' }} frameloop={interactive || idleEnabled ? 'always' : 'demand'} camera={{ position: [1.9, 3.0, 11.5], fov: THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(30) / 2) * viewportScale)) }} dpr={[1, 1.5]} gl={{ alpha: true, antialias: true }} fallback={<CrateFallback onReady={onReady} />}>
            <ambientLight intensity={1.05} />
            <directionalLight position={[4, 7, 5]} intensity={2.2} />
            <directionalLight position={[-5, 2, 3]} intensity={0.95} />
            <directionalLight position={[-1, 3, -6]} intensity={0.7} />
            <Suspense fallback={null}>
                <CrateModel interactive={interactive} rarity={rarity} rarityTransition={rarityTransition} motion={motion} idleEnabled={idleEnabled} onReady={onReady} />
            </Suspense>
        </Canvas>
    </CrateErrorBoundary>
)

useGLTF.preload(crateUrl)
export default LootCrateScene
