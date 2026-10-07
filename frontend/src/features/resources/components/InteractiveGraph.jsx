import { useMemo, useState } from 'react'

const CURVE_COLORS = ['#38bdf8', '#f59e0b', '#a78bfa', '#34d399']
const InteractiveGraph = ({ block }) => {
    const [values, setValues] = useState({})
    const xMax = Number(block.xMax) || 100
    const yMax = Number(block.yMax) || 100
    const curves = useMemo(() => (block.curves || []).map((curve) => {
        const next = { ...curve }
        ;(block.sliders || []).filter((slider) => slider.curveId === curve.id).forEach((slider) => {
            next[slider.field] = values[slider.id] ?? curve[slider.field]
        })
        return next
    }), [block.curves, block.sliders, values])
    const scaleX = (value) => 42 + (value / xMax) * 408
    const scaleY = (value) => 260 - (value / yMax) * 220
    const evaluate = (curve, x) => Number(curve.slope) * x + Number(curve.intercept)
    const points = (curve, from = 0, to = xMax) => Array.from({ length: 61 }, (_, index) => {
        const x = from + ((to - from) * index / 60)
        return `${scaleX(x)},${scaleY(evaluate(curve, x))}`
    }).join(' ')
    const first = curves[0]
    const second = curves[1]
    const intersectionX = first && second && first.slope !== second.slope ? (second.intercept - first.intercept) / (first.slope - second.slope) : null
    const intersection = intersectionX != null && intersectionX >= 0 && intersectionX <= xMax ? { x: intersectionX, y: evaluate(first, intersectionX) } : null
    const shadeEnd = intersection ? intersection.x : xMax
    const shaded = first && second ? `${points(first, 0, shadeEnd)} ${points(second, 0, shadeEnd).split(' ').reverse().join(' ')}` : ''
    return <div className='space-y-3 rounded-xl border border-neutral4 p-4'>
        <h3 className='font-semibold'>{block.title || 'Interactive graph'}</h3>
        <div className='overflow-x-auto'><svg viewBox='0 0 480 285' role='img' aria-label={`Graph of ${curves.map((curve) => curve.label).join(' and ')}`} className='min-w-[320px] w-full rounded-lg bg-neutral5/40'>
            <line x1='42' y1='260' x2='450' y2='260' stroke='currentColor' strokeOpacity='.5' /><line x1='42' y1='260' x2='42' y2='40' stroke='currentColor' strokeOpacity='.5' />
            <text x='245' y='280' textAnchor='middle' fontSize='11' fill='currentColor'>{block.xLabel || 'x'}</text><text x='8' y='145' fontSize='11' fill='currentColor'>{block.yLabel || 'y'}</text>
            <defs><clipPath id={`graph-clip-${block.id}`}><rect x='42' y='40' width='408' height='220' /></clipPath></defs>
            <g clipPath={`url(#graph-clip-${block.id})`}>{block.shadeBetween && shaded && <polygon points={shaded} fill='#facc15' fillOpacity='.16' />}{curves.map((curve, index) => <polyline key={curve.id} points={points(curve)} fill='none' stroke={CURVE_COLORS[index % CURVE_COLORS.length]} strokeWidth='2.5' />)}{block.showIntersection && intersection && <circle cx={scaleX(intersection.x)} cy={scaleY(intersection.y)} r='5' fill='#facc15' />}</g>
        </svg></div>
        <div className='flex flex-wrap gap-3 text-xs'>{curves.map((curve, index) => <span key={curve.id} className='flex items-center gap-1'><span className='h-2 w-2 rounded-full' style={{ backgroundColor: CURVE_COLORS[index % CURVE_COLORS.length] }} />{curve.label || `Curve ${index + 1}`}</span>)}</div>
        {(block.sliders || []).map((slider) => <label key={slider.id} className='block text-xs font-semibold'>{slider.label || slider.field}: <output>{values[slider.id] ?? curves.find((curve) => curve.id === slider.curveId)?.[slider.field]}</output><input type='range' min={slider.min} max={slider.max} step={slider.step} value={values[slider.id] ?? curves.find((curve) => curve.id === slider.curveId)?.[slider.field] ?? slider.min} onChange={(event) => setValues((current) => ({ ...current, [slider.id]: Number(event.target.value) }))} className='mt-1 block w-full accent-sky-400' /></label>)}
        {block.showIntersection && intersection && <p className='text-xs text-neutral1'>Intersection: ({intersection.x.toFixed(1)}, {intersection.y.toFixed(1)})</p>}
    </div>
}
export default InteractiveGraph
