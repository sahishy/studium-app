import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FaPause, FaPlay, FaRotateLeft } from 'react-icons/fa6'
import { HiSelector } from 'react-icons/hi'
import BooleanSelect from '../../../shared/components/ui/BooleanSelect'
import Select from '../../../shared/components/popovers/Select'
import { elementFrame, paramValues, regionBoundaries, repeatCount, shapePoints, stepParams } from '../utils/elementModel.js'
import { evaluateExpr } from '../utils/elementExpr.js'
import {
    VIEW, arcMeasure, arcPath, arrowHead, axisTicks, formatTick, interpolate,
    plotBox, pointsAttribute, polylineSegments, projector, ringPath, seriesColor, snapToStep, underPath,
} from '../utils/elementGeometry.js'

const GLYPH_SIZE = 4

const variantTitle = (variant) => (variant === 'simulation' ? 'Simulation' : variant === 'diagram' ? 'Diagram' : 'Graph')


const Glyph = ({ shape, point, color, radius }) => {

    const size = Math.max(GLYPH_SIZE, radius)

    if(shape.glyph === 'square') {
        return <rect x={point[0] - size} y={point[1] - size} width={size * 2} height={size * 2} rx={1.5} fill={color} stroke='var(--color-neutral5)' strokeWidth={2} paintOrder='stroke' />
    }

    if(shape.glyph === 'cross') {
        return (
            <g stroke={color} strokeWidth={2.5} strokeLinecap='round'>
                <line x1={point[0] - size} y1={point[1] - size} x2={point[0] + size} y2={point[1] + size} />
                <line x1={point[0] - size} y1={point[1] + size} x2={point[0] + size} y2={point[1] - size} />
            </g>
        )
    }

    // A surface ring keeps overlapping markers readable, and `ring` reads as hollow.
    return <circle cx={point[0]} cy={point[1]} r={size} fill={shape.glyph === 'ring' ? 'var(--color-neutral5)' : color} stroke={color} strokeWidth={2} />
}

const Shape = ({ element, shape, frame, canvas, project, readouts, onDragStart }) => {

    const color = seriesColor(shape.style.color)
    const dash = shape.style.dash ? '5 4' : undefined
    const points = shapePoints(shape, frame, element)

    if(shape.kind === 'curve') {
        return polylineSegments(points, project.toView).map((segment, index) => (
            <polyline key={index} points={pointsAttribute(segment)} fill='none' stroke={color} strokeWidth={shape.style.width} strokeDasharray={dash} strokeLinecap='round' />
        ))
    }

    if(shape.kind === 'region') {
        const boundaries = regionBoundaries(shape, frame, element)
        const path = shape.between ? ringPath(points, project.toView) : underPath(boundaries[0] ?? [], project.toView, canvas)
        return path ? <path d={path} fill={color} fillOpacity={shape.style.fillOpacity} stroke='none' /> : null
    }

    if(shape.kind === 'path') {
        const view = points.filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1])).map(project.toView)

        if(view.length < 2) return null

        return (
            <g>
                <polyline
                    points={pointsAttribute(view)}
                    fill={shape.closed ? color : 'none'}
                    fillOpacity={shape.closed ? shape.style.fillOpacity : undefined}
                    stroke={color}
                    strokeWidth={shape.style.width}
                    strokeDasharray={dash}
                    strokeLinejoin='round'
                />
                {shape.arrow !== 'none' ? <polygon points={arrowHead(view[view.length - 2], view[view.length - 1])} fill={color} /> : null}
                {shape.arrow === 'both' ? <polygon points={arrowHead(view[1], view[0])} fill={color} /> : null}
            </g>
        )
    }

    if(shape.kind === 'arc') {
        const [at, from, to] = points

        if(![at, from, to].every((point) => Number.isFinite(point[0]) && Number.isFinite(point[1]))) return null

        const radius = evaluateExpr(shape.radius, frame)
        const centre = project.toView(at)

        return (
            <g>
                <path d={arcPath(at, from, to, Number.isFinite(radius) ? radius : 1, project.toView)} fill='none' stroke={color} strokeWidth={shape.style.width} />
                {shape.showMeasure ? <text x={centre[0] + 10} y={centre[1] - 8} fontSize={11} fill='var(--color-neutral1)'>{arcMeasure(at, from, to)}°</text> : null}
            </g>
        )
    }

    const [data] = points

    if(!Number.isFinite(data[0]) || !Number.isFinite(data[1])) return null

    const view = project.toView(data)

    if(shape.kind === 'label') {
        return <text x={view[0]} y={view[1]} fontSize={11} fill='var(--color-neutral0)' textAnchor='middle'>{interpolate(shape.text, readouts)}</text>
    }

    if(shape.kind === 'image') {
        const width = project.scaleX(evaluateExpr(shape.width, frame))
        const height = project.scaleY(evaluateExpr(shape.height, frame))
        const rotation = evaluateExpr(shape.rotation, frame)

        if(!shape.url || !Number.isFinite(width) || !Number.isFinite(height)) return null

        return (
            <image
                href={shape.url}
                x={view[0] - width / 2}
                y={view[1] - height / 2}
                width={Math.abs(width)}
                height={Math.abs(height)}
                transform={Number.isFinite(rotation) && rotation ? `rotate(${-rotation} ${view[0]} ${view[1]})` : undefined}
                preserveAspectRatio='xMidYMid meet'
            />
        )
    }

    const radius = evaluateExpr(shape.radius, frame)
    const viewRadius = Number.isFinite(radius) ? Math.abs(project.scaleX(radius)) : GLYPH_SIZE

    return (
        <g
            onPointerDown={shape.drag ? (event) => onDragStart(event, shape) : undefined}
            className={shape.drag ? 'cursor-grab touch-none' : undefined}
        >
            {/* A larger invisible target than the mark itself, so dragging works on touch. */}
            {shape.drag ? <circle cx={view[0]} cy={view[1]} r={Math.max(viewRadius, 14)} fill='transparent' /> : null}
            <Glyph shape={shape} point={view} color={color} radius={viewRadius} />
            {shape.label ? <text x={view[0] + viewRadius + 5} y={view[1] + 4} fontSize={11} fill='var(--color-neutral0)'>{interpolate(shape.label, readouts)}</text> : null}
        </g>
    )
}

const Axes = ({ canvas, project }) => {

    const box = plotBox()

    return (
        <g>
            {canvas.grid ? (
                <g stroke='var(--color-neutral3)' strokeWidth={1}>
                    {axisTicks(canvas.xMin, canvas.xMax).slice(1).map((value) => {
                        const [x] = project.toView([value, canvas.yMin])
                        return <line key={`gx-${value}`} x1={x} y1={box.y} x2={x} y2={box.y + box.height} />
                    })}
                    {axisTicks(canvas.yMin, canvas.yMax).slice(1).map((value) => {
                        const [, y] = project.toView([canvas.xMin, value])
                        return <line key={`gy-${value}`} x1={box.x} y1={y} x2={box.x + box.width} y2={y} />
                    })}
                </g>
            ) : null}

            <g stroke='var(--color-neutral2)' strokeWidth={1.5}>
                <line x1={box.x} y1={box.y + box.height} x2={box.x + box.width} y2={box.y + box.height} />
                <line x1={box.x} y1={box.y} x2={box.x} y2={box.y + box.height} />
            </g>

            <g fontSize={10} fill='var(--color-neutral1)'>
                {axisTicks(canvas.xMin, canvas.xMax).map((value) => {
                    const [x, y] = project.toView([value, canvas.yMin])
                    return <text key={`tx-${value}`} x={x} y={y + 14} textAnchor='middle'>{formatTick(value)}</text>
                })}
                {axisTicks(canvas.yMin, canvas.yMax).map((value) => {
                    const [x, y] = project.toView([canvas.xMin, value])
                    return <text key={`ty-${value}`} x={x - 6} y={y + 3} textAnchor='end'>{formatTick(value)}</text>
                })}
            </g>

            {canvas.xLabel ? <text x={box.x + box.width / 2} y={VIEW.height - 4} textAnchor='middle' fontSize={11} fill='var(--color-neutral0)'>{canvas.xLabel}</text> : null}
            {canvas.yLabel ? <text x={12} y={box.y + box.height / 2} fontSize={11} fill='var(--color-neutral0)' textAnchor='middle' transform={`rotate(-90 12 ${box.y + box.height / 2})`}>{canvas.yLabel}</text> : null}
        </g>
    )
}

const ParamControl = ({ param, value, onChange }) => {

    if(param.control === 'toggle') {
        return (
            <div className='flex items-center justify-between gap-3 text-xs font-semibold text-neutral0'>
                {param.label}
                <BooleanSelect
                    value={value === 1}
                    onChange={(next) => onChange(next ? 1 : 0)}
                    leftOption={{ value: false, label: 'Off' }}
                    rightOption={{ value: true, label: 'On' }}
                />
            </div>
        )
    }

    if(param.control === 'choice') {
        const selected = param.options.find((option) => option.value === value)

        return (
            <div className='flex items-center justify-between gap-3 text-xs font-semibold text-neutral0'>
                {param.label}
                <Select
                    value={value}
                    options={param.options.map((option) => ({ value: option.value, label: option.label }))}
                    onChange={(next) => onChange(Number(next))}
                >
                    {() => (
                        <button type='button' className='flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral4 text-xs font-normal text-neutral0 cursor-pointer hover:bg-neutral3 transition-colors'>
                            {selected?.label ?? 'Choose'}
                            <HiSelector className='text-neutral1' />
                        </button>
                    )}
                </Select>
            </div>
        )
    }

    if(param.control === 'stepper') {
        return (
            <div className='flex items-center justify-between gap-3 text-xs font-semibold text-neutral0'>
                {param.label}
                <div className='flex items-center gap-2'>
                    <button type='button' aria-label={`Decrease ${param.label}`} onClick={() => onChange(value - param.step)} className='px-2 py-0.5 rounded-lg bg-neutral4 cursor-pointer hover:bg-neutral3 transition-colors'>−</button>
                    <output className='min-w-10 text-center font-normal text-neutral1'>{formatTick(value)}</output>
                    <button type='button' aria-label={`Increase ${param.label}`} onClick={() => onChange(value + param.step)} className='px-2 py-0.5 rounded-lg bg-neutral4 cursor-pointer hover:bg-neutral3 transition-colors'>+</button>
                </div>
            </div>
        )
    }

    return (
        <label className='flex flex-col gap-1 text-xs font-semibold text-neutral0'>

            <span className='flex items-center justify-between gap-3'>
                {param.label}
                <output className='font-normal text-neutral1'>{formatTick(value)}</output>
            </span>

            <input
                type='range'
                min={param.min}
                max={param.max}
                step={param.step}
                value={value}
                onChange={(event) => onChange(Number(event.target.value))}
                className='w-full accent-sat1 cursor-pointer'
            />

        </label>
    )
}

const InteractiveElement = ({ block, draft = false, shared = [], sharedValues = {} }) => {

    const element = block
    // The page's variables are merged in as ordinary parameter values, which is why the
    // element needs no concept of "shared" beyond this line.
    const initial = useMemo(() => ({ ...paramValues(element, shared), ...sharedValues }), [element, shared, sharedValues])
    // Only what the reader has changed is state. The declared values stay the source of truth,
    // so a parameter added while authoring appears immediately instead of evaluating to NaN.
    const [overrides, setOverrides] = useState({})

    const params = useMemo(() => {
        const next = { ...initial }
        Object.entries(overrides).forEach(([id, value]) => { if(id in next) next[id] = value })
        return next
    }, [initial, overrides])

    const setParams = useCallback((updater) => setOverrides((current) => {
        const base = { ...initial }
        Object.entries(current).forEach(([id, value]) => { if(id in base) base[id] = value })
        return typeof updater === 'function' ? updater(base) : updater
    }), [initial])
    const [time, setTime] = useState(0)
    const [playing, setPlaying] = useState(Boolean(element.timeline?.autoplay))
    const svgRef = useRef(null)
    const timeRef = useRef(0)
    const dragRef = useRef(null)
    const simulated = useMemo(() => element.params.some((param) => param.update), [element])

    const project = useMemo(() => projector(element.canvas), [element.canvas])
    const frame = useMemo(() => elementFrame(element, params, time), [element, params, time])

    const readouts = useMemo(() => element.readouts.map((readout) => {
        const value = evaluateExpr(readout.expr, frame)
        return { ...readout, text: Number.isFinite(value) ? value.toFixed(readout.decimals) : '—' }
    }), [element.readouts, frame])

    const scrub = useCallback((value) => {
        timeRef.current = value
        setTime(value)
    }, [])

    const reset = useCallback(() => {
        setOverrides({})
        scrub(0)
    }, [scrub])

    // One animation loop drives the clock and the update rules together, so a simulation and
    // the timeline can never disagree about what frame they are on. The clock lives in a ref
    // because reading it from state would make this effect re-subscribe every frame.
    useEffect(() => {

        if(!playing || !element.timeline) return

        const { duration, loop } = element.timeline
        let raf = 0
        let last = performance.now()

        const tick = (now) => {

            const dt = Math.min((now - last) / 1000, 1 / 20)
            last = now

            const advanced = timeRef.current + dt
            const next = advanced > duration ? (loop ? 0 : duration) : advanced

            timeRef.current = next
            setTime(next)

            if(simulated) setParams((current) => stepParams(element, current, next, dt))

            if(!loop && next >= duration) return setPlaying(false)

            raf = requestAnimationFrame(tick)
        }

        raf = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(raf)

    }, [playing, element, simulated, setParams])

    const dragTo = useCallback((event) => {

        const shape = dragRef.current

        if(!shape || !svgRef.current) return

        const rect = svgRef.current.getBoundingClientRect()
        const viewPoint = [((event.clientX - rect.left) / rect.width) * VIEW.width, ((event.clientY - rect.top) / rect.height) * VIEW.height]
        const [x, y] = project.toData(viewPoint)
        const xParam = element.params.find((param) => param.id === shape.drag.xParam)
        const yParam = element.params.find((param) => param.id === shape.drag.yParam)

        setParams((current) => ({
            ...current,
            [xParam.id]: snapToStep(x, xParam),
            [yParam.id]: snapToStep(y, yParam),
        }))

    }, [element.params, project, setParams])

    const onDragStart = useCallback((event, shape) => {
        dragRef.current = shape
        event.currentTarget.setPointerCapture?.(event.pointerId)
        dragTo(event)
    }, [dragTo])

    const onDragEnd = useCallback(() => {
        dragRef.current = null
    }, [])

    const curves = element.shapes.filter((shape) => shape.kind === 'curve' && shape.label)

    // A freshly placed element is empty by definition; say what to do with it rather than
    // showing bare axes and leaving the author guessing.
    if(draft && !element.shapes.length) {
        return (
            <section className='flex flex-col items-center justify-center gap-1 h-full p-4 rounded-2xl bg-neutral5 border border-dashed border-neutral3 text-center'>
                <p className='text-sm font-semibold text-neutral1'>{block.title || variantTitle(element.variant)}</p>
                <p className='text-xs text-neutral2'>Add something to draw from the palette.</p>
            </section>
        )
    }

    return (
        <section className='flex flex-col gap-2 h-full'>

            {block.title ? <h3 className='text-sm font-semibold text-neutral0'>{block.title}</h3> : null}

            <svg
                ref={svgRef}
                viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
                role='img'
                aria-label={block.title || 'Interactive element'}
                className='w-full touch-none'
                onPointerMove={(event) => dragRef.current && dragTo(event)}
                onPointerUp={onDragEnd}
                onPointerLeave={onDragEnd}
            >

                {element.canvas.kind === 'plane' ? <Axes canvas={element.canvas} project={project} /> : null}

                <defs>
                    <clipPath id={`element-clip-${block.id}`}>
                        <rect x={plotBox().x} y={plotBox().y} width={plotBox().width} height={plotBox().height} />
                    </clipPath>
                </defs>

                <g clipPath={`url(#element-clip-${block.id})`}>
                    {element.shapes.map((shape) => {

                        const copies = repeatCount(shape, frame)

                        return Array.from({ length: copies }, (unused, index) => (
                            <Shape
                                key={`${shape.id}-${index}`}
                                element={element}
                                shape={shape}
                                frame={shape.repeat ? { ...frame, variables: { ...frame.variables, i: index } } : frame}
                                canvas={element.canvas}
                                project={project}
                                readouts={readouts}
                                onDragStart={onDragStart}
                            />
                        ))
                    })}
                </g>

            </svg>

            {/* Identity is never colour alone: every curve with a name is listed. */}
            {curves.length > 1 ? (
                <ul className='flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral0'>
                    {curves.map((shape) => (
                        <li key={shape.id} className='flex items-center gap-1.5'>
                            <span className='w-2.5 h-2.5 rounded-full' style={{ backgroundColor: seriesColor(shape.style.color) }} />
                            {shape.label}
                        </li>
                    ))}
                </ul>
            ) : null}

            {element.timeline ? (
                <div className='flex items-center gap-2'>
                    <button type='button' onClick={() => setPlaying((current) => !current)} aria-label={playing ? 'Pause' : 'Play'} className='p-2 rounded-lg bg-neutral4 text-neutral0 cursor-pointer hover:bg-neutral3 transition-colors'>
                        {playing ? <FaPause className='text-xs' /> : <FaPlay className='text-xs' />}
                    </button>
                    <input
                        type='range'
                        min={0}
                        max={element.timeline.duration}
                        step={0.05}
                        value={time}
                        onChange={(event) => scrub(Number(event.target.value))}
                        aria-label='Time'
                        className='flex-1 accent-sat1 cursor-pointer'
                    />
                    <output className='text-xs text-neutral1'>{time.toFixed(1)}s</output>
                </div>
            ) : null}

            {element.params.length ? (
                <div className='flex flex-col gap-2.5'>
                    {element.params.map((param) => (
                        <ParamControl
                            key={param.id}
                            param={param}
                            value={params[param.id] ?? param.value}
                            onChange={(next) => setParams((current) => ({ ...current, [param.id]: snapToStep(next, param) }))}
                        />
                    ))}
                </div>
            ) : null}

            {readouts.length ? (
                <dl className='flex flex-wrap gap-x-5 gap-y-1 text-xs'>
                    {readouts.map((readout) => (
                        <div key={readout.id} className='flex gap-1.5'>
                            <dt className='text-neutral1'>{readout.label}</dt>
                            <dd className='font-semibold text-neutral0'>{readout.text}</dd>
                        </div>
                    ))}
                </dl>
            ) : null}

            {block.caption ? <p className='text-xs leading-6 text-neutral1'>{block.caption}</p> : null}

            {(element.params.length > 0 || element.timeline) ? (
                <button type='button' onClick={reset} className='flex items-center gap-1.5 self-start text-xs text-neutral1 cursor-pointer hover:text-neutral0 transition-colors'>
                    <FaRotateLeft /> Reset
                </button>
            ) : null}

        </section>
    )
}

export default InteractiveElement
