import './circles.css'
import shine from '../../../assets/images/shine.png'
import Button from '../../../shared/components/ui/Button'

const GrandQuestOrb = ({ count, target, canClaim = false, claiming = false, onClaim }) => {
    const fill = target > 0 ? 0.12 + 0.88 * Math.max(0, Math.min(1, count / target)) : 0.12
    return <div className="relative flex flex-col items-center mt-6 sm:mt-8 py-2 w-full max-w-72 sm:max-w-80 xl:max-w-88">
        <div className="relative isolate w-full aspect-square">
            {canClaim && <div aria-hidden="true" className="absolute z-0 -inset-[40%] w-[180%] aspect-square pointer-events-none bg-sky-400 opacity-[0.20] dark:opacity-[0.24] [mask-size:contain] [mask-repeat:no-repeat] [mask-position:center] animate-[spin_60s_linear_infinite]" style={{ maskImage: `url(${shine})`, WebkitMaskImage: `url(${shine})` }} />}
            <div className="circle-quest-orb relative z-10 w-full aspect-square rounded-full overflow-hidden border-4 border-neutral3/60 bg-neutral5">
                <div className="circle-quest-liquid absolute inset-x-0 bottom-0 bg-sky-400" style={{ height: `${fill * 100}%` }}>
                    {fill > 0 && fill < 1 && <>
                        <svg aria-hidden="true" className="circle-quest-wave circle-quest-wave-back" viewBox="0 0 600 40" preserveAspectRatio="none"><path d="M0 20 Q75 0 150 20 T300 20 T450 20 T600 20 V40 H0Z" fill="currentColor" /></svg>
                        <svg aria-hidden="true" className="circle-quest-wave" viewBox="0 0 600 40" preserveAspectRatio="none"><path d="M0 20 Q75 0 150 20 T300 20 T450 20 T600 20 V40 H0Z" fill="currentColor" /></svg>
                    </>}
                    <div aria-hidden="true" className="absolute inset-x-4 bottom-4 h-[70%] rounded-b-full bg-sky-300/20" />
                </div>
                <div aria-hidden="true" className="absolute top-[5%] right-[5%] w-[80%] aspect-square rounded-full bg-white/40 dark:bg-white/10 pointer-events-none" />
                <svg aria-hidden="true" viewBox="0 0 100 60" className="absolute right-[16%] top-[13%] w-[28%] h-[16%] -rotate-35"><ellipse cx="50" cy="30" rx="49" ry="29" className="fill-white/95 stroke-neutral3/30 dark:stroke-white/15" strokeWidth="1" /></svg>
                <div className={`absolute inset-0 flex flex-col items-center justify-center gap-1 text-neutral0 ${canClaim ? "pb-8" : ""}`}>
                    <p role="progressbar" aria-label="Grand Quest" aria-valuemin={0} aria-valuemax={target} aria-valuenow={Math.min(count, target)} aria-valuetext={`${count} of ${target} quests completed`} className="text-5xl sm:text-6xl font-bold tabular-nums">{count}<span className="text-2xl sm:text-3xl font-semibold opacity-60"> / {target}</span></p>
                    <p className="text-sm font-semibold text-neutral1">quests completed</p>
                    {canClaim && <Button type="secondary" disabled={claiming} loading={claiming} onClick={onClaim}
                        className="mt-3 min-w-44 px-8! py-3! text-base!">Claim reward</Button>}
                </div>
            </div>
        </div>
        <svg aria-hidden="true" viewBox="0 0 240 32" className="circle-quest-shadow relative mt-6 h-6 w-48 sm:w-56 text-neutral5"><ellipse cx="120" cy="16" rx="120" ry="16" fill="currentColor" /></svg>
    </div>
}
export default GrandQuestOrb
