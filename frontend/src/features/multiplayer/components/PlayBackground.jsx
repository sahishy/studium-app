import { useEffect, useRef } from "react";

const ORIGIN_X = 45;

const LIGHT_COLORS = [
    "#F3F4F6",
];

// Mirrors the neutral palette's dark-mode surface treatment. Keeping a
// dedicated canvas for each theme lets Tailwind swap them just like Logo and
// Podium swap their light/dark assets, without a flash while the animation is
// running.
const DARK_COLORS = [
    "#26262C",
];

const RING_COUNT = 8;
const DURATION = 40000;
const MIN_THICKNESS = 10;
const MAX_THICKNESS = 60;

const getRandomThickness = () => {
    return MIN_THICKNESS + Math.random() * (MAX_THICKNESS - MIN_THICKNESS);
}

const AnimatedRings = ({ colors, className }) => {

    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        let rafId;

        const rings = Array.from({ length: RING_COUNT }, (_, i) => ({
            color: colors[i % colors.length],
            progress: i / RING_COUNT,
            thickness: getRandomThickness(),
        }));

        let lastTime = null;

        const resize = () => {
            const pixelRatio = window.devicePixelRatio || 1;
            const width = canvas.offsetWidth;
            const height = canvas.offsetHeight;

            canvas.width = width * pixelRatio;
            canvas.height = height * pixelRatio;
            ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        };

        const draw = (timestamp) => {
            if (!lastTime) lastTime = timestamp;
            const delta = timestamp - lastTime;
            lastTime = timestamp;

            const width = canvas.offsetWidth;
            const height = canvas.offsetHeight;
            ctx.clearRect(0, 0, width, height);

            const ox = (ORIGIN_X / 100) * width;
            const oy = height / 2;

            const maxRadius = Math.sqrt(
                Math.max(ox, width - ox) ** 2 + Math.max(oy, height - oy) ** 2
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

    }, [colors]);

    return (
        <canvas
            ref={canvasRef}
            className={`absolute inset-0 h-full w-full opacity-80 ${className}`}
        />
    )
}

const PlayBackground = () => {

    return (
        <div className="absolute inset-0 z-[-1] overflow-hidden">
            <AnimatedRings colors={LIGHT_COLORS} className="dark:hidden" />
            <AnimatedRings colors={DARK_COLORS} className="hidden dark:block" />
        </div>
    )

}

export default PlayBackground;
