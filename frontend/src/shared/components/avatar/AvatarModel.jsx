import { Canvas } from "@react-three/fiber";
import { useAnimations, useGLTF, useTexture } from "@react-three/drei";
import { Component, Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";

import characterModelUrl from "../../../assets/models/character.glb";
import { AVATAR_FACES } from "../../../features/profile/utils/avatarUtils";
import RotateControls from "./RotateControls";

class AvatarModelErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    render() {
        if (this.state.hasError) {
            return <div className="w-12 h-12 rounded-full bg-neutral-800" />;
        }

        return this.props.children;
    }
}

const AvatarSceneModel = ({
    profile,
    animation = null,
    animationKey = 0,
    loop = true,
    fadeDuration = 0.12,
    opacity = 1,
    onAnimationFinished,
    ...groupProps
}) => {
    
    const groupRef = useRef();

    const { scene, animations } = useGLTF(characterModelUrl);
    const clonedScene = useMemo(() => SkeletonUtils.clone(scene), [scene]);

    const { actions, mixer } = useAnimations(animations, groupRef);
    const onAnimationFinishedRef = useRef(onAnimationFinished);

    const faceTextures = useTexture(AVATAR_FACES);
    const avatar = profile?.profile?.avatar || profile?.avatar || {};
    const selectedFace = avatar?.face ?? 0;
    const avatarColor = avatar?.color || "#ffffff";
    const faceTexture = faceTextures[selectedFace] || faceTextures[0];

    useEffect(() => {
        onAnimationFinishedRef.current = onAnimationFinished;
    }, [onAnimationFinished]);

    useEffect(() => {
        if (!faceTexture) return;

        faceTexture.flipY = false;
        faceTexture.needsUpdate = true;

        clonedScene.traverse((obj) => {
            if (!obj.isMesh) return;

            obj.castShadow = true;
            obj.receiveShadow = true;

            const materials = Array.isArray(obj.material)
                ? obj.material
                : [obj.material];

            const newMaterials = materials.map((mat) => {
                if (!mat) return mat;

                let nextMaterial;

                if (mat.name === "body") {
                    nextMaterial = new THREE.MeshToonMaterial({
                        color: avatarColor,
                    });
                    nextMaterial.name = "body";
                }

                else if (mat.name === "face") {
                    nextMaterial = new THREE.MeshBasicMaterial({
                        map: faceTexture,
                        transparent: true,
                        alphaTest: 0.5,
                    });
                    nextMaterial.name = "face";
                }

                else {
                    nextMaterial = mat.clone();
                }

                nextMaterial.transparent = opacity < 1 || nextMaterial.transparent;
                nextMaterial.opacity = Math.max(0, Math.min(1, opacity));
                nextMaterial.depthWrite = opacity >= 1;
                if (nextMaterial.name === "face" && opacity < 1) nextMaterial.alphaTest = 0.05;
                return nextMaterial;
            });

            obj.material = newMaterials.length === 1 ? newMaterials[0] : newMaterials;
        });
    }, [avatarColor, clonedScene, faceTexture, opacity]);

    useEffect(() => {
        if (!actions) return;

        Object.values(actions).forEach((action) => {
            if (action) action.stop();
        });

        if (!animation) return;

        const action = actions[animation];
        if (action) {
            action.reset();
            action.enabled = true;
            action.clampWhenFinished = !loop;
            action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
            action.setEffectiveWeight(1);
            action.setEffectiveTimeScale(1);
            if (fadeDuration > 0) action.fadeIn(fadeDuration);
            action.play();
        }

        const handleFinished = (event) => {
            if (event.action === action) {
                onAnimationFinishedRef.current?.();
            }
        };
        if (!loop && action) mixer.addEventListener("finished", handleFinished);

        return () => {
            mixer.removeEventListener("finished", handleFinished);
            if (action) {
                if (fadeDuration > 0) action.fadeOut(fadeDuration);
            }
        };
    }, [actions, animation, animationKey, fadeDuration, loop, mixer]);

    return (
        <group ref={groupRef} {...groupProps}>
            <primitive object={clonedScene} scale={1} position={[0, -1, 0]} />
        </group>
    );
};

const AvatarModel = ({ profile, animation = null, className }) => {
    return (
        <AvatarModelErrorBoundary>
            <div className={`w-48 h-48 overflow-hidden ${className}`}>
                <Canvas camera={{ position: [0, 4, 7], fov: 20 }}>

                    <ambientLight intensity={1} />
                    <directionalLight position={[0, 1, 1]} intensity={1.5} />

                    <Suspense fallback={null}>
                        <AvatarSceneModel profile={profile} animation={animation} />
                    </Suspense>

                    <RotateControls />
                </Canvas>
            </div>
        </AvatarModelErrorBoundary>
    );
};

useGLTF.preload(characterModelUrl);

export { AvatarSceneModel };
export default AvatarModel;
