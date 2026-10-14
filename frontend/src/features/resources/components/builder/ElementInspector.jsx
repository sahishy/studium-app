import { FaTrash } from 'react-icons/fa6'
import { HiSelector } from 'react-icons/hi'
import BooleanSelect from '../../../../shared/components/ui/BooleanSelect'
import Select from '../../../../shared/components/popovers/Select'
import TextField from '../../../../shared/components/ui/TextField'
import { CONTROL_KINDS, num } from '../../utils/elementDefaults.js'
import { seriesColor } from '../../utils/elementGeometry.js'
import ExpressionField from './ExpressionField'

const GLYPHS = [
    { value: 'disc', label: 'Filled dot' },
    { value: 'ring', label: 'Hollow dot' },
    { value: 'square', label: 'Square' },
    { value: 'cross', label: 'Cross' },
]

const ARROWS = [
    { value: 'none', label: 'No arrow' },
    { value: 'end', label: 'Arrow at the end' },
    { value: 'both', label: 'Arrows at both ends' },
]

const Row = ({ label, children }) => (
    <div className='flex items-center justify-between gap-3 text-xs font-semibold text-neutral0'>
        {label}
        {children}
    </div>
)

const Picker = ({ value, options, onChange, placeholder = 'Choose' }) => (
    <Select value={value} options={options} onChange={(next) => onChange(next)}>
        {() => (
            <button type='button' className='flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral5 text-xs font-normal text-neutral0 cursor-pointer hover:bg-neutral4 transition-colors'>
                {options.find((option) => String(option.value) === String(value))?.label ?? placeholder}
                <HiSelector className='text-neutral1' />
            </button>
        )}
    </Select>
)

const NumberRow = ({ label, value, onChange, step = 1 }) => (
    <Row label={label}>
        <input
            type='number'
            step={step}
            value={value}
            onChange={(event) => onChange(Number(event.target.value))}
            aria-label={label}
            className='w-24 px-2 py-1 rounded-lg bg-neutral5 text-xs font-normal text-neutral0 outline-none border border-neutral4 focus:border-neutral2'
        />
    </Row>
)

const PointField = ({ label, value, scope, onChange }) => (
    <div className='flex flex-col gap-2 p-2.5 rounded-xl bg-neutral5/60'>
        <p className='text-xs font-semibold text-neutral0'>{label}</p>
        <ExpressionField label='Across' value={value[0]} scope={scope} onChange={(next) => onChange([next, value[1]])} />
        <ExpressionField label='Up' value={value[1]} scope={scope} onChange={(next) => onChange([value[0], next])} />
    </div>
)

const CanvasInspector = ({ block, onChange }) => {

    const canvas = block.canvas
    const set = (patch) => onChange({ ...block, canvas: { ...canvas, ...patch } })

    return (
        <div className='flex flex-col gap-3'>

            <TextField label='Title' value={block.title} onChange={(value) => onChange({ ...block, title: value })} placeholder='What is this showing?' maxLength={100} />
            <TextField label='Caption' value={block.caption} onChange={(value) => onChange({ ...block, caption: value })} placeholder='A sentence under the picture' rows={2} maxLength={300} />

            <Row label='Style'>
                <BooleanSelect
                    value={canvas.kind === 'plane'}
                    onChange={(next) => set({ kind: next ? 'plane' : 'diagram' })}
                    leftOption={{ value: false, label: 'Diagram' }}
                    rightOption={{ value: true, label: 'Graph' }}
                />
            </Row>

            {canvas.kind === 'plane' ? (
                <>
                    <TextField label='Across axis' value={canvas.xLabel} onChange={(value) => set({ xLabel: value })} maxLength={50} />
                    <TextField label='Up axis' value={canvas.yLabel} onChange={(value) => set({ yLabel: value })} maxLength={50} />
                    <Row label='Grid lines'>
                        <BooleanSelect value={Boolean(canvas.grid)} onChange={(next) => set({ grid: next })} leftOption={{ value: false, label: 'Off' }} rightOption={{ value: true, label: 'On' }} />
                    </Row>
                </>
            ) : null}

            <NumberRow label='Across from' value={canvas.xMin} onChange={(value) => set({ xMin: value })} />
            <NumberRow label='Across to' value={canvas.xMax} onChange={(value) => set({ xMax: value })} />
            <NumberRow label='Up from' value={canvas.yMin} onChange={(value) => set({ yMin: value })} />
            <NumberRow label='Up to' value={canvas.yMax} onChange={(value) => set({ yMax: value })} />

        </div>
    )
}

const ParamInspector = ({ param, scope, onChange, onRemove, allowUpdate = true, removeLabel = 'Remove control' }) => {

    const set = (patch) => onChange({ ...param, ...patch })

    return (
        <div className='flex flex-col gap-3'>

            <TextField label='Name the reader sees' value={param.label} onChange={(value) => set({ label: value })} maxLength={80} />

            <Row label='Control'>
                <Picker value={param.control} options={CONTROL_KINDS.map((entry) => ({ value: entry.control, label: entry.label }))} onChange={(value) => set({ control: String(value) })} />
            </Row>

            {param.control === 'choice' ? (
                <div className='flex flex-col gap-2'>
                    {param.options.map((option, index) => (
                        <div key={index} className='flex items-center gap-2'>
                            <TextField className='flex-1' value={option.label} onChange={(value) => set({ options: param.options.map((entry, position) => (position === index ? { ...entry, label: value } : entry)) })} maxLength={80} />
                            <input
                                type='number'
                                value={option.value}
                                aria-label={`Value for ${option.label || `option ${index + 1}`}`}
                                onChange={(event) => set({ options: param.options.map((entry, position) => (position === index ? { ...entry, value: Number(event.target.value) } : entry)) })}
                                className='w-20 px-2 py-1 rounded-lg bg-neutral5 text-xs text-neutral0 outline-none border border-neutral4 focus:border-neutral2'
                            />
                            {param.options.length > 2 ? (
                                <button type='button' aria-label='Remove choice' onClick={() => set({ options: param.options.filter((entry, position) => position !== index) })} className='p-2 text-neutral1 cursor-pointer hover:text-red-500 transition-colors'>
                                    <FaTrash className='text-xs' />
                                </button>
                            ) : null}
                        </div>
                    ))}
                    {param.options.length < 6 ? (
                        <button type='button' onClick={() => set({ options: [...param.options, { label: 'Another', value: param.options.length }] })} className='self-start text-xs text-neutral1 cursor-pointer hover:text-neutral0 transition-colors'>+ Add choice</button>
                    ) : null}
                </div>
            ) : null}

            {param.control === 'slider' || param.control === 'stepper' ? (
                <>
                    <NumberRow label='Lowest' value={param.min} onChange={(value) => set({ min: value })} step='any' />
                    <NumberRow label='Highest' value={param.max} onChange={(value) => set({ max: value })} step='any' />
                    <NumberRow label='Step size' value={param.step} onChange={(value) => set({ step: value })} step='any' />
                    <NumberRow label='Starts at' value={param.value} onChange={(value) => set({ value })} step='any' />
                </>
            ) : null}

            {allowUpdate ? (
                <Row label='Changes on its own'>
                    <BooleanSelect
                        value={Boolean(param.update)}
                        onChange={(next) => set({ update: next ? ['param', param.id] : null })}
                        leftOption={{ value: false, label: 'No' }}
                        rightOption={{ value: true, label: 'Yes' }}
                    />
                </Row>
            ) : null}

            {allowUpdate && param.update ? (
                <div className='flex flex-col gap-1.5'>
                    <ExpressionField label='Each moment it becomes' value={param.update} scope={scope} onChange={(value) => set({ update: value })} />
                    <p className='text-[11px] leading-5 text-neutral1'>Needs a timeline, and only runs while the lesson is playing.</p>
                </div>
            ) : null}

            <button type='button' onClick={onRemove} className='flex items-center gap-2 self-start text-xs text-red-500 cursor-pointer hover:opacity-80 transition-opacity'>
                <FaTrash className='text-[11px]' /> {removeLabel}
            </button>

        </div>
    )
}

const ShapeInspector = ({ shape, scope, curves, params, onChange, onRemove }) => {

    const set = (patch) => onChange({ ...shape, ...patch })
    const setStyle = (patch) => set({ style: { ...shape.style, ...patch } })
    const draggableParams = params.filter((param) => param.control === 'slider' || param.control === 'stepper')
    // `i` only exists once a shape repeats, so the chip editor must only offer it then.
    const innerScope = { ...scope, variables: shape.repeat ? [...scope.variables, 'i'] : scope.variables }
    const curveScope = { ...innerScope, variables: [...innerScope.variables, 'u'] }

    return (
        <div className='flex flex-col gap-3'>

            <Row label='Colour'>
                <div className='flex gap-1.5'>
                    {Array.from({ length: 6 }, (unused, index) => (
                        <button
                            key={index}
                            type='button'
                            aria-label={`Colour ${index + 1}`}
                            onClick={() => setStyle({ color: index })}
                            style={{ backgroundColor: seriesColor(index) }}
                            className={`w-5 h-5 rounded-full cursor-pointer transition-transform ${shape.style.color === index ? 'ring-2 ring-neutral0 ring-offset-2 ring-offset-neutral6' : 'hover:scale-110'}`}
                        />
                    ))}
                </div>
            </Row>

            {shape.kind === 'curve' ? (
                <>
                    <TextField label='Name' value={shape.label} onChange={(value) => set({ label: value })} maxLength={80} />
                    <ExpressionField label='Across position' value={shape.x} scope={curveScope} onChange={(value) => set({ x: value })} />
                    <ExpressionField label='Up position' value={shape.y} scope={curveScope} onChange={(value) => set({ y: value })} />
                    <ExpressionField label='Starts at' value={shape.domain[0]} scope={innerScope} onChange={(value) => set({ domain: [value, shape.domain[1]] })} />
                    <ExpressionField label='Ends at' value={shape.domain[1]} scope={innerScope} onChange={(value) => set({ domain: [shape.domain[0], value] })} />
                </>
            ) : null}

            {shape.kind === 'path' ? (
                <>
                    {shape.points.map((point, index) => (
                        <div key={index} className='flex flex-col gap-2'>
                            <PointField label={`Point ${index + 1}`} value={point} scope={innerScope} onChange={(value) => set({ points: shape.points.map((entry, position) => (position === index ? value : entry)) })} />
                            {shape.points.length > 2 ? (
                                <button type='button' onClick={() => set({ points: shape.points.filter((entry, position) => position !== index) })} className='self-end text-xs text-red-500 cursor-pointer hover:opacity-80 transition-opacity'>Remove point</button>
                            ) : null}
                        </div>
                    ))}
                    {shape.points.length < 12 ? (
                        <button type='button' onClick={() => set({ points: [...shape.points, [num(0), num(0)]] })} className='self-start text-xs text-neutral1 cursor-pointer hover:text-neutral0 transition-colors'>+ Add point</button>
                    ) : null}
                    <Row label='Arrows'>
                        <Picker value={shape.arrow} options={ARROWS} onChange={(value) => set({ arrow: String(value) })} />
                    </Row>
                    <Row label='Join the ends'>
                        <BooleanSelect value={Boolean(shape.closed)} onChange={(next) => set({ closed: next })} leftOption={{ value: false, label: 'No' }} rightOption={{ value: true, label: 'Yes' }} />
                    </Row>
                </>
            ) : null}

            {shape.kind === 'marker' ? (
                <>
                    <PointField label='Position' value={shape.at} scope={innerScope} onChange={(value) => set({ at: value })} />
                    <ExpressionField label='Size' value={shape.radius} scope={innerScope} onChange={(value) => set({ radius: value })} />
                    <Row label='Shape'>
                        <Picker value={shape.glyph} options={GLYPHS} onChange={(value) => set({ glyph: String(value) })} />
                    </Row>
                    <TextField label='Label' value={shape.label} onChange={(value) => set({ label: value })} maxLength={80} />
                    <Row label='Reader can drag it'>
                        <BooleanSelect
                            value={Boolean(shape.drag)}
                            onChange={(next) => set({ drag: next && draggableParams.length > 1 ? { xParam: draggableParams[0].id, yParam: draggableParams[1].id } : null })}
                            leftOption={{ value: false, label: 'No' }}
                            rightOption={{ value: true, label: 'Yes' }}
                        />
                    </Row>
                    {shape.drag ? (
                        <>
                            <Row label='Dragging across sets'>
                                <Picker value={shape.drag.xParam} options={draggableParams.map((param) => ({ value: param.id, label: param.label }))} onChange={(value) => set({ drag: { ...shape.drag, xParam: String(value) } })} />
                            </Row>
                            <Row label='Dragging up sets'>
                                <Picker value={shape.drag.yParam} options={draggableParams.map((param) => ({ value: param.id, label: param.label }))} onChange={(value) => set({ drag: { ...shape.drag, yParam: String(value) } })} />
                            </Row>
                        </>
                    ) : null}
                    {!shape.drag && draggableParams.length < 2 ? (
                        <p className='text-[11px] leading-5 text-neutral1'>Dragging needs two slider or stepper controls to write to.</p>
                    ) : null}
                </>
            ) : null}

            {shape.kind === 'region' ? (
                <>
                    <Row label='From curve'>
                        <Picker value={(shape.between ?? [shape.under])[0]} options={curves.map((curve) => ({ value: curve.id, label: curve.label || 'Curve' }))} onChange={(value) => set({ between: [String(value), (shape.between ?? [])[1] ?? ''].filter(Boolean), under: shape.between?.[1] ? null : String(value) })} />
                    </Row>
                    <Row label='To curve'>
                        <Picker
                            value={(shape.between ?? [])[1] ?? ''}
                            options={[{ value: '', label: 'Down to the axis' }, ...curves.map((curve) => ({ value: curve.id, label: curve.label || 'Curve' }))]}
                            onChange={(value) => {
                                const first = (shape.between ?? [shape.under])[0] ?? ''
                                return value ? set({ between: [first, String(value)], under: null }) : set({ between: null, under: first })
                            }}
                        />
                    </Row>
                    <ExpressionField label='Starts at' value={shape.domain[0]} scope={innerScope} onChange={(value) => set({ domain: [value, shape.domain[1]] })} />
                    <ExpressionField label='Ends at' value={shape.domain[1]} scope={innerScope} onChange={(value) => set({ domain: [shape.domain[0], value] })} />
                    <Row label='Fill strength'>
                        <input type='range' min={0.04} max={0.4} step={0.02} value={shape.style.fillOpacity} onChange={(event) => setStyle({ fillOpacity: Number(event.target.value) })} aria-label='Fill strength' className='w-28 accent-sat1 cursor-pointer' />
                    </Row>
                </>
            ) : null}

            {shape.kind === 'label' ? (
                <>
                    <TextField label='Words' value={shape.text} onChange={(value) => set({ text: value })} maxLength={80} hint='Put a readout name in braces to show its value, like {Slope}.' />
                    <PointField label='Position' value={shape.at} scope={innerScope} onChange={(value) => set({ at: value })} />
                </>
            ) : null}

            {shape.kind === 'image' ? (
                <>
                    <TextField label='Image address' value={shape.url} onChange={(value) => set({ url: value })} placeholder='https://' />
                    <PointField label='Centre' value={shape.at} scope={innerScope} onChange={(value) => set({ at: value })} />
                    <ExpressionField label='Width' value={shape.width} scope={innerScope} onChange={(value) => set({ width: value })} />
                    <ExpressionField label='Height' value={shape.height} scope={innerScope} onChange={(value) => set({ height: value })} />
                    <ExpressionField label='Turned by' value={shape.rotation} scope={innerScope} onChange={(value) => set({ rotation: value })} />
                </>
            ) : null}

            {shape.kind === 'arc' ? (
                <>
                    <PointField label='Corner' value={shape.at} scope={innerScope} onChange={(value) => set({ at: value })} />
                    <PointField label='One side points to' value={shape.from} scope={innerScope} onChange={(value) => set({ from: value })} />
                    <PointField label='Other side points to' value={shape.to} scope={innerScope} onChange={(value) => set({ to: value })} />
                    <ExpressionField label='Size' value={shape.radius} scope={innerScope} onChange={(value) => set({ radius: value })} />
                    <Row label='Show the measure'>
                        <BooleanSelect value={Boolean(shape.showMeasure)} onChange={(next) => set({ showMeasure: next })} leftOption={{ value: false, label: 'No' }} rightOption={{ value: true, label: 'Yes' }} />
                    </Row>
                </>
            ) : null}

            <Row label='Draw it many times'>
                <BooleanSelect
                    value={Boolean(shape.repeat)}
                    onChange={(next) => set({ repeat: next ? { count: num(3), as: 'i' } : null, drag: next ? null : shape.drag })}
                    leftOption={{ value: false, label: 'Once' }}
                    rightOption={{ value: true, label: 'Many' }}
                />
            </Row>

            {shape.repeat ? (
                <div className='flex flex-col gap-1.5'>
                    <ExpressionField label='How many copies' value={shape.repeat.count} scope={scope} onChange={(value) => set({ repeat: { ...shape.repeat, count: value } })} />
                    <p className='text-[11px] leading-5 text-neutral1'>Use “copy number” in the positions above to spread the copies out.</p>
                </div>
            ) : null}

            <button type='button' onClick={onRemove} className='flex items-center gap-2 self-start text-xs text-red-500 cursor-pointer hover:opacity-80 transition-opacity'>
                <FaTrash className='text-[11px]' /> Remove
            </button>

        </div>
    )
}

export { CanvasInspector, ParamInspector, ShapeInspector }
