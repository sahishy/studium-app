import { useMemo } from 'react'
import { FaTrash } from 'react-icons/fa6'
import TextField from '../../../../shared/components/ui/TextField'
import { seriesColor } from '../../utils/elementGeometry.js'
import { CanvasInspector, ParamInspector, ShapeInspector } from './ElementInspector'
import ExpressionField from './ExpressionField'

const Empty = ({ text }) => <p className='px-1 text-xs leading-5 text-neutral1'>{text}</p>

const PartButton = ({ label, detail, swatch, selected, onClick }) => (
    <button
        type='button'
        onClick={onClick}
        className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-left cursor-pointer transition-colors ${selected ? 'bg-neutral5 border-neutral3' : 'bg-neutral6 dark:bg-neutral5/40 border-neutral4 hover:border-neutral3'}`}
    >
        {swatch != null ? <span className='w-2.5 h-2.5 shrink-0 rounded-full' style={{ backgroundColor: seriesColor(swatch) }} /> : null}
        <span className='min-w-0 truncate text-xs font-semibold text-neutral0'>{label}</span>
        {detail ? <span className='ml-auto shrink-0 text-[11px] text-neutral1'>{detail}</span> : null}
    </button>
)

const FrameFields = ({ frame, onChange }) => (
    <div className='grid grid-cols-2 gap-2'>
        {[['x', 'Left'], ['y', 'Top'], ['w', 'Width'], ['h', 'Height']].map(([key, label]) => (
            <label key={key} className='flex flex-col gap-1 text-xs font-semibold text-neutral0'>
                {label}
                <input
                    type='number'
                    value={Math.round(frame[key])}
                    onChange={(event) => onChange({ ...frame, [key]: Number(event.target.value) })}
                    className='w-full px-2 py-1.5 rounded-lg bg-neutral5 text-xs font-normal text-neutral0 outline-none border border-neutral4 focus:border-neutral2'
                />
            </label>
        ))}
    </div>
)

// Everything editable about the current selection, and nothing else — the canvas stays a canvas.
const PropertiesTab = ({ block, variable, pageVariables = [], selection, onSelect, onChangeBlock, onChangeVariable, onRemoveVariable, onAddReadout, onRemoveBlock, onRemovePart }) => {

    // The page's variables are in scope for every element on it, so the chip editor offers
    // them exactly where the validator would accept them.
    const scope = useMemo(() => ({
        params: [...pageVariables, ...(block?.params ?? [])],
        derived: block?.derived ?? [],
        variables: block?.timeline ? ['t'] : [],
    }), [block, pageVariables])

    if(variable) {
        return (
            <ParamInspector
                param={variable}
                scope={{ params: pageVariables, derived: [], variables: [] }}
                onChange={onChangeVariable}
                onRemove={onRemoveVariable}
                // A page has no clock yet, so a variable cannot change on its own; offering the
                // switch would promise something that is dropped on save.
                allowUpdate={false}
                removeLabel='Remove variable'
            />
        )
    }

    if(!block) return <Empty text='Select a block or a variable to edit it.' />

    const shape = block.shapes?.find((entry) => entry.id === selection.partId)
    const param = block.params?.find((entry) => entry.id === selection.partId)
    const readout = block.readouts?.find((entry) => entry.id === selection.partId)
    const patch = (changes) => onChangeBlock({ ...block, ...changes })
    const patchList = (key, next) => patch({ [key]: block[key].map((entry) => (entry.id === next.id ? next : entry)) })

    return (
        <div className='flex flex-col gap-4'>

            <section className='flex flex-col gap-2'>
                <h3 className='px-1 text-xs font-semibold uppercase tracking-wide text-neutral1'>Place on the page</h3>
                <FrameFields frame={block.frame} onChange={(frame) => patch({ frame })} />
            </section>

            {block.type === 'text' ? <TextField label='Words' value={block.text} onChange={(value) => patch({ text: value })} rows={5} maxLength={4000} /> : null}

            {block.type === 'media' ? (
                <>
                    <TextField label='Link' value={block.url} onChange={(value) => patch({ url: value })} placeholder='https://' />
                    <TextField label='Caption' value={block.caption} onChange={(value) => patch({ caption: value })} maxLength={200} />
                </>
            ) : null}

            {block.type === 'quiz' ? (
                <>
                    <TextField label='Question' value={block.prompt} onChange={(value) => patch({ prompt: value })} maxLength={500} />
                    {block.options.map((option, index) => (
                        <div key={index} className='flex items-center gap-2'>
                            <TextField className='flex-1' value={option} onChange={(value) => patch({ options: block.options.map((entry, position) => (position === index ? value : entry)) })} maxLength={200} />
                            <button
                                type='button'
                                onClick={() => patch({ answerIndex: index })}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${block.answerIndex === index ? 'bg-green-400/15 text-green-500' : 'bg-neutral5 text-neutral1 hover:text-neutral0'}`}
                            >
                                Correct
                            </button>
                        </div>
                    ))}
                    {block.options.length < 6 ? (
                        <button type='button' onClick={() => patch({ options: [...block.options, ''] })} className='self-start text-xs text-neutral1 cursor-pointer hover:text-neutral0 transition-colors'>+ Add option</button>
                    ) : null}
                    <TextField label='Explanation' value={block.explanation} onChange={(value) => patch({ explanation: value })} maxLength={1000} />
                </>
            ) : null}

            {block.type === 'interactive' ? (
                <>
                    <section className='flex flex-col gap-2'>
                        <h3 className='px-1 text-xs font-semibold uppercase tracking-wide text-neutral1'>Parts</h3>

                        <PartButton label='The whole element' selected={!selection.partId} onClick={() => onSelect({ ...selection, partId: null, part: null })} />

                        {block.shapes.map((entry) => (
                            <PartButton
                                key={entry.id}
                                label={entry.label || entry.text || entry.kind}
                                detail={entry.repeat ? 'repeated' : undefined}
                                swatch={entry.style.color}
                                selected={selection.partId === entry.id}
                                onClick={() => onSelect({ ...selection, part: 'shape', partId: entry.id })}
                            />
                        ))}

                        {block.params.map((entry) => (
                            <PartButton key={entry.id} label={entry.label || 'Control'} detail={entry.control} selected={selection.partId === entry.id} onClick={() => onSelect({ ...selection, part: 'param', partId: entry.id })} />
                        ))}

                        {block.readouts.map((entry) => (
                            <PartButton key={entry.id} label={entry.label || 'Readout'} detail='readout' selected={selection.partId === entry.id} onClick={() => onSelect({ ...selection, part: 'readout', partId: entry.id })} />
                        ))}

                        <button type='button' onClick={onAddReadout} className='px-2.5 py-2 rounded-lg border border-dashed border-neutral3 text-xs font-semibold text-neutral1 cursor-pointer hover:text-neutral0 hover:border-neutral2 transition-colors'>
                            + Readout
                        </button>
                    </section>

                    {!selection.partId ? <CanvasInspector block={block} onChange={onChangeBlock} /> : null}

                    {shape ? (
                        <ShapeInspector
                            shape={shape}
                            scope={scope}
                            params={block.params}
                            curves={block.shapes.filter((entry) => entry.kind === 'curve')}
                            onChange={(next) => patchList('shapes', next)}
                            onRemove={() => onRemovePart('shapes', shape.id)}
                        />
                    ) : null}

                    {param ? (
                        <ParamInspector
                            param={param}
                            scope={scope}
                            onChange={(next) => patchList('params', next)}
                            onRemove={() => onRemovePart('params', param.id)}
                        />
                    ) : null}

                    {readout ? (
                        <>
                            <TextField label='Name' value={readout.label} onChange={(value) => patchList('readouts', { ...readout, label: value })} maxLength={80} />
                            <ExpressionField label='Shows' value={readout.expr} scope={scope} onChange={(value) => patchList('readouts', { ...readout, expr: value })} />
                            <button type='button' onClick={() => onRemovePart('readouts', readout.id)} className='flex items-center gap-2 self-start text-xs text-red-500 cursor-pointer hover:opacity-80 transition-opacity'>
                                <FaTrash className='text-[11px]' /> Remove readout
                            </button>
                        </>
                    ) : null}
                </>
            ) : null}

            <button type='button' onClick={onRemoveBlock} className='flex items-center gap-2 self-start pt-2 text-xs text-red-500 cursor-pointer hover:opacity-80 transition-opacity border-t border-neutral4 w-full'>
                <FaTrash className='text-[11px] mt-2' /> <span className='mt-2'>Delete this block</span>
            </button>

        </div>
    )
}

export default PropertiesTab
