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

const Model = ({ profile, animation = null }) => {
    
    const groupRef = useRef();

    const { scene, animations } = useGLTF(characterModelUrl);
    const clonedScene = useMemo(() => SkeletonUtils.clone(scene), [scene]);

    const { actions } = useAnimations(animations, groupRef);

    const faceTextures = useTexture(AVATAR_FACES);
    const avatar = profile?.profile?.avatar || profile?.avatar || {};
    const selectedFace = avatar?.face ?? 0;
    const faceTexture = faceTextures[selectedFace] || faceTextures[0];

    useEffect(() => {
        if (!faceTexture) return;

        faceTexture.flipY = false;
        faceTexture.needsUpdate = true;

        clonedScene.traverse((obj) => {
            if (!obj.isMesh) return;

            const materials = Array.isArray(obj.material)
                ? obj.material
                : [obj.material];

            const newMaterials = materials.map((mat) => {
                if (!mat) return mat;

                if (mat.name === "body") {
                    const bodyMat = new THREE.MeshToonMaterial({
                        color: avatar?.color || "#ffffff",
                    });
                    bodyMat.name = "body";
                    return bodyMat;
                }

                if (mat.name === "face") {
                    const faceMat = new THREE.MeshBasicMaterial({
                        map: faceTexture,
                        transparent: true,
                        alphaTest: 0.5,
                    });
                    faceMat.name = "face";
                    return faceMat;
                }

                return mat;
            });

            obj.material = newMaterials.length === 1 ? newMaterials[0] : newMaterials;
        });
    }, [clonedScene, faceTexture, profile]);

    useEffect(() => {
        if (!actions) return;

        Object.values(actions).forEach((action) => {
            if (action) action.stop();
        });

        if (!animation) return;

        const action = actions[animation];
        if (action) {
            action.reset().fadeIn(0.2).play();
        }

        return () => {
            if (action) {
                action.fadeOut(0.2);
            }
        };
    }, [actions, animation]);

    return (
        <group ref={groupRef}>
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
                        <Model profile={profile} animation={animation} />
                    </Suspense>

                    <RotateControls />
                </Canvas>
            </div>
        </AvatarModelErrorBoundary>
    );
};

useGLTF.preload(characterModelUrl);

export default AvatarModel;