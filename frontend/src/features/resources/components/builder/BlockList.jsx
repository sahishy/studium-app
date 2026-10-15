import { FaArrowDown, FaArrowUp, FaTrash } from 'react-icons/fa6'
import { seriesColor } from '../../utils/elementGeometry.js'

const BLOCK_LABELS = { text: 'Text', media: 'Media', quiz: 'Quiz', interactive: 'Interactive' }

const Item = ({ title, subtitle, selected, swatch, onSelect, onMoveUp, onMoveDown, onRemove }) => (
    <div className={`flex items-center gap-2 p-2 rounded-xl border transition-colors ${selected ? 'bg-neutral5 border-neutral3' : 'bg-neutral6 dark:bg-neutral5/40 border-neutral4 hover:border-neutral3'}`}>

        <button type='button' onClick={onSelect} className='flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer'>
            {swatch != null ? <span className='w-2.5 h-2.5 shrink-0 rounded-full' style={{ backgroundColor: seriesColor(swatch) }} /> : null}
            <span className='min-w-0'>
                <span className='block truncate text-sm font-semibold text-neutral0'>{title}</span>
                {subtitle ? <span className='block truncate text-[11px] text-neutral1'>{subtitle}</span> : null}
            </span>
        </button>

        {onMoveUp ? <button type='button' aria-label='Move up' onClick={onMoveUp} className='p-1.5 text-neutral1 cursor-pointer hover:text-neutral0 transition-colors'><FaArrowUp className='text-[11px]' /></button> : null}
        {onMoveDown ? <button type='button' aria-label='Move down' onClick={onMoveDown} className='p-1.5 text-neutral1 cursor-pointer hover:text-neutral0 transition-colors'><FaArrowDown className='text-[11px]' /></button> : null}
        {onRemove ? <button type='button' aria-label='Remove' onClick={onRemove} className='p-1.5 text-neutral1 cursor-pointer hover:text-red-500 transition-colors'><FaTrash className='text-[11px]' /></button> : null}

    </div>
)

const summarise = (block) => {
    if(block.type === 'text') return block.text?.slice(0, 60) || 'Empty'
    if(block.type === 'media') return block.url || 'No link yet'
    if(block.type === 'quiz') return block.prompt || 'No question yet'
    return `${block.shapes.length} drawn, ${block.params.length} to change`
}

const BlockList = ({ blocks, selection, onSelect, onReorder, onRemove }) => (
    <div className='flex flex-col gap-4'>

        <section className='flex flex-col gap-2'>
            <h3 className='px-1 text-xs font-semibold uppercase tracking-wide text-neutral1'>Blocks</h3>

            {blocks.length ? blocks.map((block, index) => (
                <Item
                    key={block.id}
                    title={BLOCK_LABELS[block.type] ?? block.type}
                    subtitle={summarise(block)}
                    selected={selection.blockId === block.id && !selection.part}
                    onSelect={() => onSelect({ blockId: block.id })}
                    onMoveUp={index > 0 ? () => onReorder(index, -1) : undefined}
                    onMoveDown={index < blocks.length - 1 ? () => onReorder(index, 1) : undefined}
                    onRemove={() => onRemove(block.id)}
                />
            )) : (
                <p className='px-1 text-xs leading-5 text-neutral1'>Nothing yet. Pick something from the palette on the right.</p>
            )}
        </section>

    </div>
)

const ElementParts = ({ block, selection, onSelect, onReorder, onRemove }) => (
    <div className='flex flex-col gap-4'>

        <section className='flex flex-col gap-2'>
            <h3 className='px-1 text-xs font-semibold uppercase tracking-wide text-neutral1'>Drawn</h3>

            {block.shapes.length ? block.shapes.map((shape, index) => (
                <Item
                    key={shape.id}
                    title={shape.label || shape.text || shape.kind}
                    subtitle={shape.repeat ? 'Repeated' : undefined}
                    swatch={shape.style.color}
                    selected={selection.part === 'shape' && selection.partId === shape.id}
                    onSelect={() => onSelect({ blockId: block.id, part: 'shape', partId: shape.id })}
                    onMoveUp={index > 0 ? () => onReorder('shapes', index, -1) : undefined}
                    onMoveDown={index < block.shapes.length - 1 ? () => onReorder('shapes', index, 1) : undefined}
                    onRemove={() => onRemove('shapes', shape.id)}
                />
            )) : <p className='px-1 text-xs leading-5 text-neutral1'>Nothing drawn yet.</p>}
        </section>

        {block.params.length ? (
            <section className='flex flex-col gap-2'>
                <h3 className='px-1 text-xs font-semibold uppercase tracking-wide text-neutral1'>Reader controls</h3>
                {block.params.map((param) => (
                    <Item
                        key={param.id}
                        title={param.label || 'Control'}
                        subtitle={param.control}
                        selected={selection.part === 'param' && selection.partId === param.id}
                        onSelect={() => onSelect({ blockId: block.id, part: 'param', partId: param.id })}
                        onRemove={() => onRemove('params', param.id)}
                    />
                ))}
            </section>
        ) : null}

        {block.readouts.length ? (
            <section className='flex flex-col gap-2'>
                <h3 className='px-1 text-xs font-semibold uppercase tracking-wide text-neutral1'>Readouts</h3>
                {block.readouts.map((readout) => (
                    <Item
                        key={readout.id}
                        title={readout.label || 'Readout'}
                        selected={selection.part === 'readout' && selection.partId === readout.id}
                        onSelect={() => onSelect({ blockId: block.id, part: 'readout', partId: readout.id })}
                        onRemove={() => onRemove('readouts', readout.id)}
                    />
                ))}
            </section>
        ) : null}

    </div>
)

export { BlockList, ElementParts }
