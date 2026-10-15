import { useState } from 'react'
import { PiStarFourFill } from 'react-icons/pi'
import Button from '../../shared/components/ui/Button'
import logoSmall from '../../assets/images/logo_sm.png'
import studyTutorial from '../../assets/videos/study_tutorial.mp4'
import playTutorial from '../../assets/videos/play_tutorial.mp4'

const bothPreviewStartTimes = [3.7, 8.2]

const paths = [
    {
        id: 'study',
        title: 'Study',
        text: 'Organize your tasks, add your classes, and explore student-made lessons.',
        xp: 150,
    },
    {
        id: 'play',
        title: 'Gameplay',
        text: 'Play a quick game, learn about progression, and unlock new cosmetics.',
        xp: 150,
    },
    {
        id: 'both',
        title: 'Both',
        text: 'Get to know Studium through a quick game and some task organization.',
        xp: 300,
    },
]

function TutorialPreview({ path }) {
    const isBoth = path === 'both'
    const videos = isBoth
        ? [studyTutorial, playTutorial]
        : [path === 'study' ? studyTutorial : playTutorial]

    return (
        <span
            aria-hidden="true"
            className="pointer-events-none relative block aspect-video w-full max-w-80 shrink-0"
        >
            {videos.map((src, index) => isBoth ? (
                <span
                    key={src}
                    className={`absolute block aspect-[16/9.1] w-[68%] overflow-hidden rounded-lg border border-neutral4 shadow-lg shadow-shadow ${
                        index === 0
                            ? 'top-[4%] left-[3%] -rotate-4'
                            : 'right-[3%] bottom-[4%] rotate-4'
                    }`}
                >
                    <video
                        ref={video => {
                            if (video) video.playbackRate = 0.5
                        }}
                        onLoadedMetadata={event => {
                            event.currentTarget.currentTime = bothPreviewStartTimes[index]
                        }}
                        className="absolute inset-0 block h-full w-full rounded-lg object-contain"
                        src={src}
                        autoPlay
                        loop
                        muted
                        playsInline
                        tabIndex={-1}
                        disablePictureInPicture
                    />
                </span>
            ) : (
                <video
                    key={src}
                    className="block h-full w-full rounded-xl border border-neutral4 object-contain shadow-lg shadow-shadow"
                    src={src}
                    autoPlay
                    loop
                    muted
                    playsInline
                    tabIndex={-1}
                    disablePictureInPicture
                />
            ))}
        </span>
    )
}

export default function PathChoice({ dialogRef, busy, error, onStart, onSkip }) {
    const [leaving, setLeaving] = useState(false)
    const [selectedPath, setSelectedPath] = useState('play')
    const disabled = busy || leaving

    const choose = async path => {
        if (disabled) return

        setLeaving(true)
        await new Promise(resolve => setTimeout(resolve, 450))

        try {
            await onStart(path)
        } catch {
            setLeaving(false)
        }
    }

    return (
        <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Choose your first activity"
            className={`fixed inset-0 z-[190] flex flex-col items-center overflow-y-auto bg-white/[.94] px-5 pt-4 pb-12 text-[#111827] backdrop-blur-[32px] transition-[opacity,backdrop-filter] duration-[450ms] ease-[ease] motion-reduce:transition-none md:pt-6 md:pb-14 ${
                leaving ? 'pointer-events-none opacity-0' : 'opacity-100'
            }`}
        >
            <div className="flex w-full flex-1 shrink-0 flex-col items-center justify-center gap-6 pb-12 md:gap-9">
                <div className="relative -top-2 flex shrink-0 flex-col items-center text-center md:-top-8">
                    <img
                        src={logoSmall}
                        alt="Studium"
                        className="mb-6 size-10 object-contain"
                    />
                    <h1 className="text-3xl font-bold">Welcome to Studium</h1>
                    <p className="mt-2 text-sm text-neutral1">
                        Explore the platform’s features through an interactive guide.
                    </p>
                </div>

                <div
                    role="group"
                    aria-label="Tutorial paths"
                    className="grid w-full max-w-4xl shrink-0 gap-7 md:grid-cols-3 md:gap-9"
                >
                    {paths.map(({ id, title, text, xp }, index) => (
                        <div
                            key={id}
                            className="motion-safe:animate-quest-float"
                            style={{
                                animationDelay: `${index * -2}s`,
                                '--quest-tilt': `${index === 1 ? -1 : 1}deg`,
                            }}
                        >
                            <button
                                disabled={disabled}
                                aria-pressed={selectedPath === id}
                                onClick={() => setSelectedPath(id)}
                                className={`flex h-full w-full cursor-pointer flex-col items-center gap-2 rounded-3xl border bg-neutral6 p-4 text-center text-neutral0 transition-[transform,scale,border-color,opacity] duration-250 ease-[ease] aria-[pressed=false]:opacity-65 focus:outline-none focus-visible:ring-4 focus-visible:ring-neutral4 disabled:cursor-not-allowed motion-reduce:transition-none md:p-7 ${
                                    selectedPath === id
                                        ? 'scale-[1.08] border-neutral2 ring-4 ring-neutral4'
                                        : 'scale-100 border-neutral4 not-disabled:hover:scale-[1.025]'
                                }`}
                            >
                                <TutorialPreview path={id} />
                                <h2 className="mt-4 text-xl font-semibold">{title}</h2>
                                <p className="flex-1 text-sm leading-relaxed text-neutral1">
                                    {text}
                                </p>
                                <span className="flex items-center justify-center gap-1 text-sm font-semibold text-amber-500">
                                    <PiStarFourFill aria-hidden="true" />
                                    +{xp} XP
                                </span>
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {error && (
                <p role="alert" className="text-sm text-red-500">
                    {error}
                </p>
            )}

            <div className="flex w-full max-w-sm shrink-0 items-center gap-3">
                <Button
                    type="secondary"
                    className="min-w-24 rounded-full! px-6 py-4"
                    disabled={disabled}
                    onClick={onSkip}
                >
                    Skip
                </Button>
                <Button
                    type="primary"
                    className="flex-1 rounded-full! py-4"
                    disabled={disabled}
                    onClick={() => choose(selectedPath)}
                >
                    Continue
                </Button>
            </div>
        </div>
    )
}
