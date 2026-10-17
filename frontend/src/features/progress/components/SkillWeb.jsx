import { useEffect, useMemo, useRef, useState } from 'react'
import { FaChartPie } from 'react-icons/fa6'
import BaseTooltip from '../../../shared/components/tooltips/BaseTooltip'
import LoadingState from '../../../shared/components/ui/LoadingState'
import { axisPoint, normalizeDomains, smoothRadarPath } from '../utils/masteryUtils'

const CENTER = { x: 210, y: 140 }
const RADIUS = 92
const COLORS = { reading: 'var(--color-green-400)', math: 'var(--color-red-400)' }
const DESCRIPTIONS = {
    'Information and Ideas': 'Find main ideas, interpret evidence, and draw conclusions.',
    'Craft and Structure': 'Understand vocabulary, purpose, and how a text is built.',
    'Expression of Ideas': 'Connect ideas and revise writing for clarity and flow.',
    'Standard English Conventions': 'Use grammar, punctuation, and sentence structure.',
    Algebra: 'Solve linear equations, inequalities, and systems.',
    'Advanced Math': 'Work with nonlinear equations, expressions, and functions.',
    'Problem-Solving and Data Analysis': 'Reason with ratios, statistics, and real-world data.',
    'Geometry and Trigonometry': 'Explore shapes, angles, area, and trigonometric relationships.',
}

const DomainTooltipContent = ({ domain, previousAccuracy }) => (
    <div role='tooltip' className='w-56 rounded-xl border border-neutral4 bg-neutral6 p-3 shadow-xl shadow-shadow'>
        <p className='flex items-center gap-1.5 text-xs font-semibold text-neutral0'>
            <span aria-hidden='true' className='size-1.5 shrink-0 rounded-full' style={{ backgroundColor: COLORS[domain.section] }} />
            {domain.id}
        </p>
        <p className='mt-1 text-xs leading-relaxed text-neutral1'>{DESCRIPTIONS[domain.id]}</p>
        <p className='mt-3 flex items-baseline gap-1 text-lg font-semibold text-sky-400'>
            {Math.round(domain.accuracy * 100)}<span className='text-[10px] font-medium text-neutral1'>/ 100 mastery</span>
        </p>
        {previousAccuracy != null ? <p className='mt-1 text-xs text-neutral1'>Before match: {Math.round(previousAccuracy * 100)} mastery</p> : null}
    </div>
)

const SkillWeb = ({ board = null, comparisonBoard = null, loading = false, className = '' }) => {
    const domains = useMemo(() => normalizeDomains(board?.domains), [board?.domains])
    const previousDomains = useMemo(() => comparisonBoard ? normalizeDomains(comparisonBoard.domains) : null, [comparisonBoard])
    const [grown, setGrown] = useState(0)
    const [hoveredDomain, setHoveredDomain] = useState(null)
    const [focusedDomain, setFocusedDomain] = useState(null)
    const activeDomain = hoveredDomain ?? focusedDomain
    const activeIndex = domains.findIndex((domain) => domain.id === activeDomain)
    const frame = useRef(null)
    useEffect(() => {
        const start = performance.now()
        const step = () => {
            const progress = Math.min(1, (performance.now() - start) / 450)
            setGrown(1 - (1 - progress) ** 3)
            if(progress < 1) frame.current = requestAnimationFrame(step)
        }
        frame.current = requestAnimationFrame(step)
        return () => cancelAnimationFrame(frame.current)
    }, [board?.answered])
    const count = domains.length
    return (
        <div className={`flex flex-col gap-3 ${className}`} aria-busy={loading}>
            <h2 className='flex items-center justify-center gap-2 text-sm font-semibold text-neutral0'>
                Skills <FaChartPie className='text-sm text-neutral1' />
            </h2>
            {loading ? <LoadingState className='aspect-[420/280]' /> : <BaseTooltip
                placement='cursor' gap={12} open={activeIndex >= 0} className='mx-auto w-full max-w-[28rem]'
                content={activeIndex >= 0 ? <DomainTooltipContent domain={domains[activeIndex]} previousAccuracy={previousDomains?.[activeIndex].accuracy} /> : null}>
                <div className='relative w-full'>
                    <svg viewBox='0 0 420 280' className='block w-full' role='img'
                        aria-label={`Mastery scores by SAT domain: ${domains.map((d) => `${d.label} ${Math.round(d.accuracy * 100)}`).join(', ')}.${previousDomains ? ` Before this match: ${previousDomains.map((d) => `${d.label} ${Math.round(d.accuracy * 100)}`).join(', ')}.` : ''} New domains start at 50 mastery.`}>
                        {[0.25, 0.5, 0.75, 1].map((fraction) => <circle key={fraction}
                            cx={CENTER.x} cy={CENTER.y} r={RADIUS * fraction}
                            className='fill-none stroke-neutral4' strokeWidth={0.8} />)}
                        {domains.map((d, i) => {
                            const outer = axisPoint(i, count, RADIUS, CENTER)
                            return <line key={d.id} x1={CENTER.x} y1={CENTER.y} x2={outer.x} y2={outer.y}
                                className='stroke-neutral4' strokeOpacity={0.5} strokeWidth={1} />
                        })}
                        {previousDomains ? <path d={smoothRadarPath(previousDomains.map((d) => d.accuracy * grown), { radius: RADIUS, center: CENTER })}
                            fill='var(--color-neutral1)' fillOpacity={0.08} stroke='var(--color-neutral1)' strokeOpacity={0.4}
                            strokeWidth={1.5} strokeDasharray='4 3' strokeLinejoin='round' /> : null}
                        <path d={smoothRadarPath(domains.map((d) => d.accuracy * grown), { radius: RADIUS, center: CENTER })}
                            fill='var(--color-sky-400)' fillOpacity={0.24} stroke='var(--color-sky-400)' strokeWidth={1.5} strokeLinejoin='round' />
                        {domains.map((d, i) => {
                            const point = axisPoint(i, count, RADIUS * d.accuracy * grown, CENTER)
                            return <circle key={d.id} cx={point.x} cy={point.y} r={2.5} fill='var(--color-sky-400)' stroke='var(--color-sky-400)' strokeWidth={1}
                                className={`transition-opacity duration-200 ${activeDomain === d.id ? 'opacity-40' : 'opacity-100'}`} />
                        })}
                        {domains.map((domain, index) => {
                            // Each domain owns the wedge halfway to its neighboring axes,
                            // including the space between the graph and its label.
                            const radius = RADIUS + 24
                            const start = axisPoint(index - 0.5, count, radius, CENTER)
                            const end = axisPoint(index + 0.5, count, radius, CENTER)
                            return <path key={domain.id} aria-hidden='true'
                                d={`M ${CENTER.x} ${CENTER.y} L ${start.x} ${start.y} A ${radius} ${radius} 0 0 1 ${end.x} ${end.y} Z`}
                                fill='transparent'
                                onMouseEnter={() => setHoveredDomain(domain.id)}
                                onMouseLeave={() => setHoveredDomain(null)} />
                        })}
                    </svg>
                    {domains.map((domain, index) => {
                        const point = axisPoint(index, count, RADIUS + 24, CENTER)
                        const offset = point.x > CENTER.x + 4 ? '0' : point.x < CENTER.x - 4 ? '-100%' : '-50%'
                        return <div key={domain.id} className='absolute' style={{ left: `${point.x / 420 * 100}%`, top: `${point.y / 280 * 100}%`, transform: `translate(${offset}, -50%)` }}>
                            <button type='button'
                                onMouseEnter={() => setHoveredDomain(domain.id)} onMouseLeave={() => setHoveredDomain(null)}
                                onFocus={() => setFocusedDomain(domain.id)} onBlur={() => setFocusedDomain(null)}
                                className={`flex items-center gap-1.5 rounded px-1 py-2 text-[10px] font-medium text-neutral1 transition-[color,opacity] duration-200 hover:text-neutral0 focus-visible:text-neutral0 focus-visible:outline-2 focus-visible:outline-sky-300 ${activeDomain === domain.id ? 'opacity-60' : 'opacity-100'}`}
                                aria-description={DESCRIPTIONS[domain.id]} aria-label={`${domain.id}, ${Math.round(domain.accuracy * 100)} mastery`}>
                                <span aria-hidden='true' className='size-1.5 shrink-0 rounded-full' style={{ backgroundColor: COLORS[domain.section] }} />
                                {domain.short}
                            </button>
                        </div>
                    })}
                </div>
            </BaseTooltip>}
        </div>
    )
}
export default SkillWeb
