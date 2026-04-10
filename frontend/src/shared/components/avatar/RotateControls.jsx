import { OrbitControls } from "@react-three/drei";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";

const RotateControls = () => {

    const controlsRef = useRef(null);
    const lastInteraction = useRef(Date.now());
    const isInteracting = useRef(false);

    const DEFAULT_AZIMUTH = 0;

    useFrame((_, delta) => {

        const controls = controlsRef.current;
        if(!controls) return
        if(isInteracting.current) return;

        const idleTime = Date.now() - lastInteraction.current;

        // After 2 seconds idle, return to front
        if(idleTime > 2000) {
            const current = controls.getAzimuthalAngle();
            const diff = DEFAULT_AZIMUTH - current;

            controls.setAzimuthalAngle(
                current + diff * Math.min(1, delta * 16)
            );
            controls.update();
        }
    });

    return (
        <OrbitControls
            ref={controlsRef}
            enableZoom={false}
            enablePan={false}
            target={[0, 0.2, 0]}
            minPolarAngle={Math.PI / 2.4}
            maxPolarAngle={Math.PI / 2.4}
            onStart={() => {
                isInteracting.current = true;
                lastInteraction.current = Date.now();
            }}
            onEnd={() => {
                isInteracting.current = false;
                lastInteraction.current = Date.now();
            }}
        />
    );
};

export default RotateControls;