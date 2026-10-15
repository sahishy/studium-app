import { useDraggable } from '@dnd-kit/core'
import { FaChartLine, FaCircleQuestion, FaFont, FaLink, FaPlay, FaPlus, FaShapes, FaSliders } from 'react-icons/fa6'
import { HiSelector } from 'react-icons/hi'
import BaseTooltip from '../../../../shared/components/tooltips/BaseTooltip'
import Dropdown from '../../../../shared/components/popovers/Dropdown'
import { BLOCK_KINDS, CONTROL_KINDS, SHAPE_KINDS } from '../../utils/elementDefaults.js'

const BLOCK_ICONS = {
    text: <FaFont />,
    media: <FaLink />,
    quiz: <FaCircleQuestion />,
    graph: <FaChartLine />,
    diagram: <FaShapes />,
    simulation: <FaPlay />,
}

// Every palette entry shows what it makes, drawn at a glance rather than described. The sketch
// is the same geometry the real thing uses, just small.
const SKETCHES = {
    text: <g><rect x='6' y='14' width='52' height='3' rx='1.5' /><rect x='6' y='22' width='44' height='3' rx='1.5' /><rect x='6' y='30' width='48' height='3' rx='1.5' /></g>,
    media: <g><rect x='8' y='12' width='48' height='22' rx='4' fill='none' strokeWidth='2' stroke='currentColor' /><path d='M27,19 L37,24 L27,29 Z' /></g>,
    quiz: <g><rect x='6' y='10' width='34' height='4' rx='2' /><rect x='6' y='20' width='52' height='7' rx='3.5' opacity='.35' /><rect x='6' y='31' width='52' height='7' rx='3.5' opacity='.2' /></g>,
    graph: <g fill='none' stroke='currentColor' strokeWidth='2'><path d='M10,38 L10,8 M10,38 L58,38' opacity='.4' /><path d='M12,34 L54,12' /><path d='M12,14 L54,34' opacity='.6' /></g>,
    diagram: <g fill='none' stroke='currentColor' strokeWidth='2'><circle cx='32' cy='16' r='6' /><circle cx='16' cy='34' r='5' /><circle cx='48' cy='34' r='5' /><path d='M28,21 L20,30 M36,21 L44,30' /></g>,
    simulation: <g fill='none' stroke='currentColor' strokeWidth='2'><path d='M8,34 C20,34 24,12 36,12 C46,12 50,22 58,22' /><circle cx='36' cy='12' r='4' fill='currentColor' /></g>,
}

const Sketch = ({ type }) => (
    <svg viewBox='0 0 64 48' className='w-full h-20 text-neutral0' fill='currentColor' aria-hidden='true'>
        {SKETCHES[type] ?? null}
    </svg>
)

const PaletteCard = ({ type, label, description, children }) => (
    <BaseTooltip
        placement='left'
        delay={250}
        content={(
            <div className='flex flex-col gap-2 w-56 p-3 rounded-xl bg-neutral6 dark:bg-neutral4 border border-neutral4 shadow-lg shadow-shadow'>
                <div className='p-2 rounded-lg bg-neutral5'>
                    <Sketch type={type} />
                </div>
                <p className='text-sm font-semibold text-neutral0'>{label}</p>
                <p className='text-xs leading-5 text-neutral1'>{description}</p>
            </div>
        )}
    >
        {children}
    </BaseTooltip>
)

const Tile = ({ icon, label, dim = false, onClick, innerRef, handleProps }) => (
    <div
        ref={innerRef}
        onClick={onClick}
        {...(handleProps ?? {})}
        className={`group flex items-center gap-2.5 p-2.5 rounded-xl border border-neutral4 bg-neutral6 dark:bg-neutral5/40 transition-colors
            ${onClick ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'}
            ${dim ? 'opacity-40' : 'hover:bg-neutral5 hover:border-neutral3'}`}
    >
        <span className='shrink-0 text-sm text-neutral1 group-hover:text-neutral0 transition-colors'>{icon}</span>
        <span className='min-w-0 truncate text-sm font-semibold text-neutral0'>{label}</span>
    </div>
)

const DraggableTile = ({ id, data, icon, label }) => {

    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, data })

    return <Tile innerRef={setNodeRef} handleProps={{ ...listeners, ...attributes }} icon={icon} label={label} dim={isDragging} />
}

const Section = ({ title, hint, children }) => (
    <section className='flex flex-col gap-2'>
        <h3 className='px-1 text-xs font-semibold uppercase tracking-wide text-neutral1'>{title}</h3>
        {hint ? <p className='px-1 text-[11px] leading-4 text-neutral1'>{hint}</p> : null}
        {children}
    </section>
)

const PaletteTab = ({ selectedElement, onPlaceBlock, onAddShape, onAddVariable }) => (
    <div className='flex flex-col gap-5'>

        <Section title='Blocks' hint='Drag one onto a page, or click to drop it in.'>
            {BLOCK_KINDS.map((entry) => (
                <PaletteCard key={entry.type} type={entry.type} label={entry.label} description={entry.description}>
                    <div onClick={() => onPlaceBlock(entry.type)}>
                        <DraggableTile id={`new-${entry.type}`} data={{ kind: 'new', type: entry.type }} icon={BLOCK_ICONS[entry.type]} label={entry.label} />
                    </div>
                </PaletteCard>
            ))}
        </Section>

        {/* Shapes only exist once there is something to put them in, so they appear with the
            element rather than sitting greyed out waiting to be understood. */}
        {selectedElement ? (
            <Section title={`Inside “${selectedElement.title || 'this element'}”`} hint='Click to add, or drag onto any element.'>
                {SHAPE_KINDS.map((entry) => (
                    <PaletteCard key={entry.kind} type='diagram' label={entry.label} description={entry.description}>
                        <div onClick={() => onAddShape(entry.kind)}>
                            <DraggableTile
                                id={`shape-${entry.kind}`}
                                data={{ kind: 'shape', shape: entry.kind }}
                                icon={<svg viewBox='0 0 32 32' className='w-4 h-4'><path d={entry.preview} fill='none' stroke='currentColor' strokeWidth={2.5} strokeLinecap='round' /></svg>}
                                label={entry.label}
                            />
                        </div>
                    </PaletteCard>
                ))}
            </Section>
        ) : null}

        <Section title='Variables' hint='Something the reader changes. Everything on the page can use it.'>
            <Dropdown
                options={CONTROL_KINDS.map((entry) => ({ label: entry.label, icon: <FaSliders className='text-sm' /> }))}
                onSelect={(option) => onAddVariable(CONTROL_KINDS.find((entry) => entry.label === option.label).control)}
            >
                {() => (
                    <button type='button' className='flex items-center justify-between gap-2 w-full p-2.5 rounded-xl border border-dashed border-neutral3 text-sm font-semibold text-neutral1 cursor-pointer hover:text-neutral0 hover:border-neutral2 transition-colors'>
                        <span className='flex items-center gap-2'><FaPlus className='text-xs' /> Add a variable</span>
                        <HiSelector />
                    </button>
                )}
            </Dropdown>
        </Section>

    </div>
)

export default PaletteTab
