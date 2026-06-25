import { useEffect, useRef } from "react";

const ORIGIN_X = 33;

const COLORS = [
    "#F3F4F6",
];

const RING_COUNT = 8;
const DURATION = 40000;
const MIN_THICKNESS = 10;
const MAX_THICKNESS = 60;

const getRandomThickness = () => {
    return MIN_THICKNESS + Math.random() * (MAX_THICKNESS - MIN_THICKNESS);
}

const PlayBackground = () => {

    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        let rafId;

        const rings = Array.from({ length: RING_COUNT }, (_, i) => ({
            color: COLORS[i % COLORS.length],
            progress: i / RING_COUNT,
            thickness: getRandomThickness(),
        }));

        let lastTime = null;

        const resize = () => {
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
        };

        const draw = (timestamp) => {
            if (!lastTime) lastTime = timestamp;
            const delta = timestamp - lastTime;
            lastTime = timestamp;

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const ox = (ORIGIN_X / 100) * canvas.width;
            const oy = canvas.height / 2;

            const maxRadius = Math.sqrt(
                Math.max(ox, canvas.width - ox) ** 2 + Math.max(oy, canvas.height - oy) ** 2
            );

            for (const ring of rings) {
                ring.progress += delta / DURATION;
                if (ring.progress > 1) {
                    ring.progress -= 1;
                    ring.thickness = getRandomThickness();
                }

                const t = ring.progress;
                const radius = t * maxRadius;

                const eased = 1 - Math.pow(1 - t, 2);
                const opacity = t < 0.06
                    ? (t / 0.06) * 0.8
                    : 0.8 * (1 - (eased - 0.06) / 0.94);

                ctx.beginPath();
                ctx.arc(ox, oy, Math.max(0, radius), 0, Math.PI * 2);
                ctx.strokeStyle = ring.color;
                ctx.lineWidth = ring.thickness;
                ctx.globalAlpha = Math.max(0, opacity);
                ctx.stroke();
            }

            ctx.globalAlpha = 1;
            rafId = requestAnimationFrame(draw);

        };

        resize();
        window.addEventListener("resize", resize);
        rafId = requestAnimationFrame(draw);

        return () => {
            cancelAnimationFrame(rafId);
            window.removeEventListener("resize", resize);
        };

    }, []);

    return (
        <div className="absolute inset-0 z-[-1] overflow-hidden">
            <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full"
            />
        </div>
    )

}

export default PlayBackground;