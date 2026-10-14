import { useDraggable, useDroppable } from '@dnd-kit/core'
import { FaArrowDown, FaArrowUp, FaClone, FaPlus, FaTrash } from 'react-icons/fa6'
import TextTooltip from '../../../../shared/components/tooltips/TextTooltip'
import LessonPage, { LessonBlock } from '../LessonPage'
import VariableControls from '../VariableControls'
import { GRID, clampFrame } from '../../utils/elementDefaults.js'

// The grid is drawn rather than implied, so snapping looks deliberate instead of jumpy.
const GridLines = ({ visible }) => (
    <div
        className={`pointer-events-none absolute inset-0 transition-opacity duration-150 ${visible ? 'opacity-70' : 'opacity-0'}`}
        style={{
            backgroundImage: 'linear-gradient(to right, var(--color-neutral4) 1px, transparent 1px), linear-gradient(to bottom, var(--color-neutral4) 1px, transparent 1px)',
            backgroundSize: `${GRID * 2}% ${(GRID * 2 * 16) / 9}%`,
        }}
    />
)

// Dragging a corner resizes; the maths is the same percentage conversion the drop uses, so a
// resized block lands on the grid like everything else.
const ResizeHandles = ({ frame, pageNode, onResize }) => {

    const corners = [
        { id: 'nw', x: 0, y: 0, cursor: 'nwse-resize' },
        { id: 'ne', x: 1, y: 0, cursor: 'nesw-resize' },
        { id: 'sw', x: 0, y: 1, cursor: 'nesw-resize' },
        { id: 'se', x: 1, y: 1, cursor: 'nwse-resize' },
    ]

    const start = (event, corner) => {

        event.preventDefault()
        event.stopPropagation()

        const rect = pageNode?.getBoundingClientRect()

        if(!rect) return

        const origin = { x: event.clientX, y: event.clientY, ...frame }

        const move = (moveEvent) => {

            const dx = ((moveEvent.clientX - origin.x) / rect.width) * 100
            const dy = ((moveEvent.clientY - origin.y) / rect.height) * 100

            // Dragging a left or top corner moves the origin as well as the size; dragging a
            // right or bottom one only changes the size.
            onResize(clampFrame({
                x: corner.x === 0 ? origin.x + dx : origin.x,
                y: corner.y === 0 ? origin.y + dy : origin.y,
                w: corner.x === 0 ? origin.w - dx : origin.w + dx,
                h: corner.y === 0 ? origin.h - dy : origin.h + dy,
            }))
        }

        const end = () => {
            window.removeEventListener('pointermove', move)
            window.removeEventListener('pointerup', end)
        }

        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', end)
    }

    return corners.map((corner) => (
        <span
            key={corner.id}
            role='presentation'
            onPointerDown={(event) => start(event, corner)}
            style={{ cursor: corner.cursor, left: `${corner.x * 100}%`, top: `${corner.y * 100}%` }}
            className='absolute z-30 w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-neutral6 border-2 border-sat1'
        />
    ))
}

const BlockControls = ({ onRaise, onLower, onDuplicate, onRemove }) => (
    <div className='absolute -top-3 right-0 z-30 flex items-center gap-1 p-1 rounded-lg bg-neutral6 dark:bg-neutral4 border border-neutral4 shadow-md shadow-shadow'>
        {[
            { icon: <FaArrowUp />, label: 'Bring forward', onClick: onRaise },
            { icon: <FaArrowDown />, label: 'Send backward', onClick: onLower },
            { icon: <FaClone />, label: 'Duplicate', onClick: onDuplicate },
            { icon: <FaTrash />, label: 'Delete', onClick: onRemove, danger: true },
        ].map((control) => (
            <TextTooltip key={control.label} text={control.label} placement='top'>
                <button
                    type='button'
                    aria-label={control.label}
                    // The controls sit on top of a draggable, so the drag must not start here.
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => { event.stopPropagation(); control.onClick() }}
                    className={`p-1.5 rounded-md text-[10px] cursor-pointer transition-colors ${control.danger ? 'text-neutral1 hover:text-red-500' : 'text-neutral1 hover:text-neutral0'} hover:bg-neutral5`}
                >
                    {control.icon}
                </button>
            </TextTooltip>
        ))}
    </div>
)

const DraggableBlock = ({ block, page, pageNode, selected, droppingShape, onSelect, onRaise, onLower, onDuplicate, onRemove, onResize, values }) => {

    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `block-${block.id}`,
        data: { kind: 'block', blockId: block.id, pageId: page.id, frame: block.frame },
    })

    // While a shape is being dragged, every element says plainly whether it can take it.
    const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `into-${block.id}`, data: { blockId: block.id }, disabled: block.type !== 'interactive' })
    const takesShapes = block.type === 'interactive'

    return (
        <div
            ref={setNodeRef}
            onPointerDown={() => onSelect(block.id)}
            style={{
                left: `${block.frame.x}%`,
                top: `${block.frame.y}%`,
                width: `${block.frame.w}%`,
                height: `${block.frame.h}%`,
                transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
            }}
            className={`absolute rounded-xl transition-shadow
                ${isDragging ? 'opacity-30' : ''}
                ${droppingShape && !takesShapes ? 'opacity-30' : ''}
                ${droppingShape && takesShapes ? 'ring-2 ring-dashed ring-sat1/60' : ''}
                ${isOver ? 'ring-2 ring-sat1' : ''}
                ${selected && !droppingShape ? 'ring-2 ring-sat1' : 'ring-1 ring-transparent hover:ring-neutral3'}`}
        >
            <div ref={takesShapes ? setDropRef : undefined} className='absolute inset-0' />
            {selected && !isDragging ? (
                <>
                    <BlockControls onRaise={onRaise} onLower={onLower} onDuplicate={onDuplicate} onRemove={onRemove} />
                    <ResizeHandles frame={block.frame} pageNode={pageNode} onResize={onResize} />
                </>
            ) : null}

            {/* Only the body starts a drag, so the controls above stay clickable. The block is
                shown rather than operated while authoring. */}
            <div className='w-full h-full overflow-hidden cursor-grab active:cursor-grabbing' {...listeners} {...attributes}>
                <div className='w-full h-full pointer-events-none'>
                    {/* The page's variables have to reach the block here too, or an element
                        that reads one would draw nothing while being authored. */}
                    <LessonBlock block={block} draft variables={page.variables} values={values} />
                </div>
            </div>
        </div>
    )
}

const PageAction = ({ icon, label, onClick, disabled, danger }) => (
    <TextTooltip text={label} placement='top'>
        <button
            type='button'
            aria-label={label}
            onClick={onClick}
            disabled={disabled}
            className={`p-1.5 rounded-md text-[11px] cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-default
                ${danger ? 'text-neutral1 hover:text-red-500' : 'text-neutral1 hover:text-neutral0'}`}
        >
            {icon}
        </button>
    </TextTooltip>
)

const PageDropArea = ({ page, index, total, onRemove, onMove, onDuplicate, registerRect, children }) => {

    const { setNodeRef, isOver } = useDroppable({ id: `page-${page.id}`, data: { pageId: page.id } })

    const attach = (node) => {
        setNodeRef(node)
        registerRect(page.id, node)
    }

    return (
        <div className='group/page flex flex-col gap-2'>

            <div className='flex items-center justify-between px-1'>

                <p className='text-xs font-semibold text-neutral1'>Page {index + 1} of {total}</p>

                <div className='flex items-center gap-0.5 opacity-0 group-hover/page:opacity-100 focus-within:opacity-100 transition-opacity'>
                    <PageAction icon={<FaArrowUp />} label='Move page up' onClick={() => onMove(-1)} disabled={index === 0} />
                    <PageAction icon={<FaArrowDown />} label='Move page down' onClick={() => onMove(1)} disabled={index === total - 1} />
                    <PageAction icon={<FaClone />} label='Duplicate page' onClick={onDuplicate} />
                    <PageAction icon={<FaTrash />} label='Delete page' onClick={onRemove} disabled={!onRemove} danger />
                </div>

            </div>

            <div ref={attach} className={`rounded-2xl transition-shadow ${isOver ? 'ring-2 ring-sat1' : ''}`}>
                {children}
            </div>

        </div>
    )
}

const LessonCanvas = ({ pages, pageNodes, selectedBlockId, selectedVariableId, droppingShape, dragging, values, onSelectBlock, onSelectVariable, onChangeValue, onAddPage, onRemovePage, onMovePage, onDuplicatePage, onReorderBlock, onDuplicateBlock, onRemoveBlock, onResizeBlock, registerRect }) => (
    <div className='flex flex-col gap-6 p-6 rounded-3xl bg-neutral5 overflow-y-auto no-scrollbar'>

        {pages.map((page, index) => (
            <PageDropArea
                key={page.id}
                page={page}
                index={index}
                total={pages.length}
                registerRect={registerRect}
                onMove={(direction) => onMovePage(page.id, direction)}
                onDuplicate={() => onDuplicatePage(page.id)}
                onRemove={pages.length > 1 ? () => onRemovePage(page.id) : null}
            >
                <LessonPage page={{ ...page, blocks: [] }} values={values}>
                    <GridLines visible={dragging} />

                    {page.blocks.length ? null : (
                        <div className='pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 text-center'>
                            <p className='text-sm font-semibold text-neutral1'>This page is empty</p>
                            <p className='text-xs text-neutral2'>Drag a block from the palette, or click one to drop it here.</p>
                        </div>
                    )}
                    {page.blocks.map((block) => (
                        <DraggableBlock
                            key={block.id}
                            block={block}
                            page={page}
                            values={values}
                            pageNode={pageNodes.current.get(page.id)}
                            selected={block.id === selectedBlockId}
                            droppingShape={droppingShape}
                            onSelect={onSelectBlock}
                            onRaise={() => onReorderBlock(page.id, block.id, 1)}
                            onLower={() => onReorderBlock(page.id, block.id, -1)}
                            onDuplicate={() => onDuplicateBlock(page.id, block.id)}
                            onRemove={() => onRemoveBlock(block.id)}
                            onResize={(frame) => onResizeBlock(block.id, frame)}
                        />
                    ))}
                </LessonPage>

                <VariableControls
                    className='mt-1'
                    variables={page.variables}
                    values={values}
                    onChange={onChangeValue}
                    onEdit={onSelectVariable}
                    selectedId={selectedVariableId}
                />
            </PageDropArea>
        ))}

        <button
            type='button'
            onClick={onAddPage}
            className='flex items-center justify-center gap-2 py-4 rounded-2xl border border-dashed border-neutral3 text-sm font-semibold text-neutral1 cursor-pointer hover:border-neutral2 hover:text-neutral0 transition-colors'
        >
            <FaPlus className='text-xs' /> Add page
        </button>

    </div>
)

export default LessonCanvas
