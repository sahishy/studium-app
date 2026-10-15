import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { FaArrowLeft, FaRotateLeft, FaRotateRight } from 'react-icons/fa6'
import Button from '../../../shared/components/ui/Button'
import ErrorState from '../../../shared/components/ui/ErrorState'
import LoadingState from '../../../shared/components/ui/LoadingState'
import TextTabSelector from '../../../shared/components/ui/TextTabSelector'
import TextTooltip from '../../../shared/components/tooltips/TextTooltip'
import Topbar from '../../../shared/components/ui/Topbar'
import LessonCanvas from '../components/builder/LessonCanvas'
import PaletteTab from '../components/builder/PaletteTab'
import PropertiesTab from '../components/builder/PropertiesTab'
import EditLessonModal from '../components/EditLessonModal'
import { useModal } from '../../../shared/contexts/ModalContext'
import { deleteResource, getResource, saveResource } from '../services/resourceService'
import { validateElement } from '../utils/elementModel.js'
import useEditHistory from '../utils/useEditHistory.js'
import { BLOCK_KINDS, GRID, clampFrame, defaultFrame, newBlock, newId, newPage, newReadout, newShape, newVariable, remapBlock } from '../utils/elementDefaults.js'

const TABS = [{ name: 'palette', label: 'Palette' }, { name: 'properties', label: 'Properties' }]
const VIEWS = [{ name: 'builder', label: 'Builder' }, { name: 'settings', label: 'Settings' }]

const emptyLesson = () => ({ type: 'lesson', title: 'Untitled draft', description: '', subject: '', status: 'draft', pages: [newPage()] })

// The preview runs the same validator publishing does, so a problem shows up while it is being
// made rather than at the end.
const checkBlock = (block, variables = []) => {
    if(block?.type !== 'interactive') return ''

    try {
        validateElement(block, false, variables)
        return ''
    } catch (error) {
        return error.message
    }
}

// The same row the Circles settings use: a label, its current value, and an Edit action that
// opens a modal rather than editing in place.
const DetailRow = ({ label, value, action, onActionClick }) => (
    <div className='py-3'>
        <div className='flex items-start justify-between gap-6'>
            <div className='min-w-0'>
                <p className='text-sm font-semibold text-neutral0'>{label}</p>
                {value ? <p className='text-sm text-neutral1 break-words'>{value}</p> : null}
            </div>
            {action ? (
                <button type='button' onClick={onActionClick} className='shrink-0 text-sm font-semibold text-neutral1 cursor-pointer hover:text-neutral0 transition-colors'>
                    {action}
                </button>
            ) : null}
        </div>
    </div>
)

const LessonBuilderPage = () => {

    const { resourceId } = useParams()
    const navigate = useNavigate()
    const { profile } = useOutletContext()
    const { openModal, closeModal } = useModal()

    const { state: lesson, change: setLesson, reset: resetLesson, undo, redo, canUndo, canRedo } = useEditHistory(emptyLesson())
    const [saved, setSaved] = useState('')
    const [selection, setSelection] = useState({ blockId: null, partId: null, variableId: null })
    const [values, setValues] = useState({})
    const [view, setView] = useState('builder')
    const [tab, setTab] = useState('palette')
    const [loading, setLoading] = useState(Boolean(resourceId))
    const [error, setError] = useState('')
    const [saving, setSaving] = useState(false)
    const [dragging, setDragging] = useState(null)
    const pageRects = useRef(new Map())

    // A keyboard sensor means the builder is usable without a mouse: tab to a block, space to
    // pick it up, arrows to move it.
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor))

    useEffect(() => {

        if(!resourceId) return

        let active = true

        getResource(resourceId)
            .then((loaded) => {
                if(!active) return
                const opened = { ...emptyLesson(), ...loaded, pages: loaded.pages?.length ? loaded.pages : [newPage()] }
                resetLesson(opened)
                setSaved(JSON.stringify(opened))
            })
            .catch((failure) => active && setError(failure.message || 'That lesson could not be opened.'))
            .finally(() => active && setLoading(false))

        return () => { active = false }

    }, [resourceId, resetLesson])

    const pages = useMemo(() => lesson.pages || [], [lesson.pages])
    const block = useMemo(() => pages.flatMap((page) => page.blocks).find((entry) => entry.id === selection.blockId) ?? null, [pages, selection.blockId])
    const page = useMemo(() => pages.find((entry) => entry.blocks.some((item) => item.id === selection.blockId) || entry.variables?.some((item) => item.id === selection.variableId)) ?? pages[0], [pages, selection])
    const variable = useMemo(() => page?.variables?.find((entry) => entry.id === selection.variableId) ?? null, [page, selection.variableId])
    const problem = useMemo(() => checkBlock(block, page?.variables), [block, page])

    const setPages = useCallback((next) => setLesson((current) => ({ ...current, pages: typeof next === 'function' ? next(current.pages) : next })), [setLesson])

    const changeBlock = useCallback((next) => {
        setPages((current) => current.map((page) => ({ ...page, blocks: page.blocks.map((entry) => (entry.id === next.id ? next : entry)) })))
    }, [setPages])

    // Later in the list means drawn on top, so raising a block is a swap with its neighbour.
    const reorderBlock = useCallback((pageId, blockId, direction) => {
        setPages((current) => current.map((page) => {

            if(page.id !== pageId) return page

            const index = page.blocks.findIndex((entry) => entry.id === blockId)
            const target = index + direction

            if(index < 0 || target < 0 || target >= page.blocks.length) return page

            const blocks = [...page.blocks]
            ;[blocks[index], blocks[target]] = [blocks[target], blocks[index]]
            return { ...page, blocks }
        }))
    }, [setPages])

    const removeBlock = useCallback((id) => {
        setPages((current) => current.map((page) => ({ ...page, blocks: page.blocks.filter((entry) => entry.id !== id) })))
        setSelection({ blockId: null, partId: null })
    }, [setPages])

    const registerRect = useCallback((pageId, node) => {
        if(node) pageRects.current.set(pageId, node)
        else pageRects.current.delete(pageId)
    }, [])

    // A drop lands wherever the pointer released, converted into page percentages and snapped
    // to the grid, so the frame means the same thing at any zoom or screen size.
    const handleDragEnd = ({ active, over, delta }) => {

        setDragging(null)

        const data = active.data.current

        if(data?.kind === 'block') {
            const rect = pageRects.current.get(data.pageId)?.getBoundingClientRect()

            if(!rect) return

            return setPages((current) => current.map((page) => (page.id !== data.pageId ? page : {
                ...page,
                blocks: page.blocks.map((entry) => (entry.id !== data.blockId ? entry : {
                    ...entry,
                    frame: clampFrame({ ...entry.frame, x: entry.frame.x + (delta.x / rect.width) * 100, y: entry.frame.y + (delta.y / rect.height) * 100 }),
                })),
            })))
        }

        if(data?.kind === 'shape') {
            const targetId = over?.data?.current?.blockId
            const target = pages.flatMap((entry) => entry.blocks).find((entry) => entry.id === targetId)

            if(!target || target.type !== 'interactive') return

            const curveIds = target.shapes.filter((shape) => shape.kind === 'curve').map((shape) => shape.id)
            const made = newShape(data.shape, target.canvas, target.shapes.length, curveIds)

            changeBlock({ ...target, shapes: [...target.shapes, made] })
            setSelection({ blockId: target.id, part: 'shape', partId: made.id, variableId: null })
            return setTab('properties')
        }

        if(data?.kind !== 'new' || !over) return

        const pageId = over.data.current?.pageId
        const rect = pageRects.current.get(pageId)?.getBoundingClientRect()
        const pointer = active.rect.current.translated
        const size = defaultFrame(data.type)

        const frame = rect && pointer
            ? clampFrame({ ...size, x: ((pointer.left - rect.left) / rect.width) * 100, y: ((pointer.top - rect.top) / rect.height) * 100 })
            : size

        const created = newBlock(data.type, frame)

        setPages((current) => current.map((page) => (page.id === pageId ? { ...page, blocks: [...page.blocks, created] } : page)))
        setSelection({ blockId: created.id, partId: null })
        setTab('properties')
    }

    const addVariable = (control) => {

        const target = page ?? pages[0]
        const made = newVariable(control, target?.variables?.length ?? 0)

        setPages((current) => current.map((entry) => (entry.id === target.id ? { ...entry, variables: [...(entry.variables ?? []), made] } : entry)))
        setSelection({ blockId: null, partId: null, variableId: made.id })
        setTab('properties')
    }

    const changeVariable = (next) => setPages((current) => current.map((entry) => ({
        ...entry,
        variables: (entry.variables ?? []).map((item) => (item.id === next.id ? next : item)),
    })))

    const removeVariable = (id) => {
        setPages((current) => current.map((entry) => ({ ...entry, variables: (entry.variables ?? []).filter((item) => item.id !== id) })))
        setSelection((current) => ({ ...current, variableId: null }))
    }

    const addPart = (key, made) => {
        changeBlock({ ...block, [key]: [...block[key], made] })
        setSelection((current) => ({ ...current, partId: made.id }))
        setTab('properties')
    }

    const editDetails = () => openModal(
        <EditLessonModal
            lesson={lesson}
            closeModal={closeModal}
            onSave={(details) => setLesson((current) => ({ ...current, ...details }))}
        />
    )

    const remove = async () => {

        if(!resourceId) return

        setSaving(true)

        try {
            await deleteResource(resourceId)
            navigate('/resources')
        } catch (failure) {
            setError(failure.message || 'That could not be deleted.')
            setSaving(false)
        }
    }

    const dirty = saved !== JSON.stringify(lesson)

    const movePage = (pageId, direction) => setPages((current) => {

        const index = current.findIndex((entry) => entry.id === pageId)
        const target = index + direction

        if(index < 0 || target < 0 || target >= current.length) return current

        const next = [...current]
        ;[next[index], next[target]] = [next[target], next[index]]
        return next
    })

    // A duplicated page needs fresh ids throughout, or the copy and the original would be the
    // same blocks and the same variables as far as every reference is concerned.
    const duplicatePage = (pageId) => setPages((current) => current.flatMap((entry) => {

        if(entry.id !== pageId) return [entry]

        // New ids throughout, and every expression rewritten to follow them, so the copy is
        // independent of the original rather than quietly sharing its controls.
        const map = Object.fromEntries((entry.variables ?? []).map((variable) => [variable.id, newId()]))

        return [entry, {
            ...entry,
            id: newId(),
            variables: (entry.variables ?? []).map((variable) => ({ ...variable, id: map[variable.id] })),
            blocks: entry.blocks.map((block) => ({ ...remapBlock(block, map), id: newId() })),
        }]
    }))

    const duplicateBlock = (pageId, blockId) => {
        setPages((current) => current.map((entry) => {

            if(entry.id !== pageId) return entry

            const original = entry.blocks.find((item) => item.id === blockId)

            if(!original) return entry

            // Offset the copy so it is obviously a second thing, not a failed click.
            const copy = { ...original, id: newId(), frame: clampFrame({ ...original.frame, x: original.frame.x + GRID, y: original.frame.y + GRID }) }
            return { ...entry, blocks: [...entry.blocks, copy] }
        }))
    }

    const resizeBlock = (blockId, frame) => setPages((current) => current.map((entry) => ({
        ...entry,
        blocks: entry.blocks.map((item) => (item.id === blockId ? { ...item, frame } : item)),
    })))

    const nudgeBlock = (dx, dy) => {

        if(!block) return

        resizeBlock(block.id, clampFrame({ ...block.frame, x: block.frame.x + dx * GRID, y: block.frame.y + dy * GRID }))
    }

    // Clicking a palette tile drops the block on the current page: the same outcome as a drag,
    // for anyone who would rather not drag, or cannot.
    const placeBlock = (type) => {

        const target = page ?? pages[0]
        const created = newBlock(type)

        setPages((current) => current.map((entry) => (entry.id === target.id ? { ...entry, blocks: [...entry.blocks, created] } : entry)))
        setSelection({ blockId: created.id, partId: null, variableId: null })
        setTab('properties')
    }

    const save = async (status) => {

        setSaving(true)
        setError('')

        try {
            // The API returns the saved resource itself. Keeping its id is what stops the next
            // save creating a second draft.
            const result = await saveResource({ ...lesson, status })
            const next = { ...lesson, ...result, status }

            setLesson(() => next)
            setSaved(JSON.stringify(next))

            if(!resourceId && result?.id) navigate(`/resources/build/${result.id}`, { replace: true })
            if(status === 'published') navigate('/resources')
        } catch (failure) {
            setError(failure.message || 'That could not be saved.')
        } finally {
            setSaving(false)
        }
    }

    // Browser-level shortcuts an editor is expected to have. Typing in a field is left alone.
    useEffect(() => {

        const onKey = (event) => {

            const typing = ['INPUT', 'TEXTAREA'].includes(event.target?.tagName) || event.target?.isContentEditable

            if((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
                event.preventDefault()
                return event.shiftKey ? redo() : undo()
            }

            if(typing || !block) return

            if(event.key === 'Escape') return setSelection({ blockId: null, partId: null, variableId: null })
            if(event.key === 'Backspace' || event.key === 'Delete') {
                event.preventDefault()
                return removeBlock(block.id)
            }
            if((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd') {
                event.preventDefault()
                return duplicateBlock(page.id, block.id)
            }

            const nudges = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }

            if(nudges[event.key]) {
                event.preventDefault()
                nudgeBlock(...nudges[event.key])
            }
        }

        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    })

    // Closing the tab mid-edit should not silently lose the page.
    useEffect(() => {

        if(!dirty) return

        const warn = (event) => { event.preventDefault() }

        window.addEventListener('beforeunload', warn)
        return () => window.removeEventListener('beforeunload', warn)
    }, [dirty])

    if(loading) return <LoadingState className='h-full' />

    return (
        <div className='flex flex-col h-full overflow-hidden'>

            <Topbar profile={profile} />

            <div className='flex flex-col gap-4 flex-1 min-h-0 p-6'>

                <div className='grid grid-cols-[1fr_auto_1fr] items-center gap-4'>

                    <div className='flex items-center gap-3 min-w-0'>
                        <button type='button' aria-label='Back to resources' onClick={() => navigate('/resources')} className='shrink-0 p-2.5 rounded-full bg-neutral5 text-neutral0 cursor-pointer hover:bg-neutral4 transition-colors'>
                            <FaArrowLeft className='text-sm' />
                        </button>
                        <h1 className='truncate text-xl font-semibold text-neutral0'>{lesson.title || 'Untitled draft'}</h1>
                    </div>

                    <TextTabSelector
                        className='justify-self-center'
                        tabs={VIEWS}
                        currentIndex={VIEWS.findIndex((entry) => entry.name === view)}
                        onSelect={(entry) => setView(entry.name)}
                    />

                    <div className='flex items-center gap-2 justify-self-end'>

                        <TextTooltip text='Undo' placement='bottom'>
                            <button type='button' aria-label='Undo' onClick={undo} disabled={!canUndo} className='p-2.5 rounded-full bg-neutral5 text-neutral0 cursor-pointer hover:bg-neutral4 disabled:opacity-40 disabled:cursor-default transition-colors'>
                                <FaRotateLeft className='text-xs' />
                            </button>
                        </TextTooltip>

                        <TextTooltip text='Redo' placement='bottom'>
                            <button type='button' aria-label='Redo' onClick={redo} disabled={!canRedo} className='p-2.5 rounded-full bg-neutral5 text-neutral0 cursor-pointer hover:bg-neutral4 disabled:opacity-40 disabled:cursor-default transition-colors'>
                                <FaRotateRight className='text-xs' />
                            </button>
                        </TextTooltip>

                        <span className='px-1 text-xs text-neutral1'>{saving ? 'Saving…' : dirty ? 'Unsaved changes' : 'All changes saved'}</span>

                        <Button type='secondary' onClick={() => save('draft')} disabled={saving || !dirty}>Save draft</Button>
                        <Button type='primary' onClick={() => save('published')} disabled={saving}>Publish</Button>
                    </div>

                </div>

                {error ? <ErrorState text={error} /> : null}

                {view === 'settings' ? (
                    <div className='w-full max-w-3xl flex flex-col gap-12 mx-auto overflow-y-auto no-scrollbar'>

                        <section className='flex flex-col gap-6 pt-12'>

                            <h2 className='text-xl font-semibold text-neutral0'>Lesson Details</h2>

                            <div className='divide-y divide-neutral4'>
                                <DetailRow label='Lesson name' value={lesson.title || '—'} action='Edit' onActionClick={editDetails} />
                                <DetailRow label='Subject' value={lesson.subject || '—'} action='Edit' onActionClick={editDetails} />
                                <DetailRow label='Description' value={lesson.description || '—'} action='Edit' onActionClick={editDetails} />
                                <DetailRow label='Pages' value={`${pages.length} ${pages.length === 1 ? 'page' : 'pages'}`} />
                                <DetailRow label='Status' value={lesson.status === 'published' ? 'Published' : 'Draft'} />
                            </div>

                        </section>

                        <section className='flex flex-col gap-6'>

                            <h2 className='text-xl font-semibold text-neutral0'>Manage Lesson</h2>

                            <div className='divide-y divide-neutral4'>
                                <div className='py-3 flex items-center justify-between gap-6'>
                                    <div>
                                        <p className='font-semibold text-neutral0'>Delete lesson</p>
                                        <p className='text-sm text-neutral1'>Permanently delete this lesson.</p>
                                    </div>
                                    <Button type='negative' onClick={remove} disabled={!resourceId || saving}>Delete Lesson</Button>
                                </div>
                            </div>

                        </section>

                    </div>
                ) : (
                    <DndContext sensors={sensors} onDragStart={({ active }) => setDragging(active.data.current)} onDragEnd={handleDragEnd} onDragCancel={() => setDragging(null)}>

                        <div className='grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4 flex-1 min-h-0'>

                            <LessonCanvas
                                pages={pages}
                                selectedBlockId={selection.blockId}
                                onSelectBlock={(id) => { setSelection({ blockId: id, partId: null, variableId: null }); setTab('properties') }}
                                selectedVariableId={selection.variableId}
                                droppingShape={dragging?.kind === 'shape'}
                                dragging={Boolean(dragging)}
                                values={values}
                                onSelectVariable={(id) => { setSelection({ blockId: null, partId: null, variableId: id }); setTab('properties') }}
                                onChangeValue={(id, value) => setValues((current) => ({ ...current, [id]: value }))}
                                onAddPage={() => setPages((current) => [...current, newPage()])}
                                onMovePage={movePage}
                                onDuplicatePage={duplicatePage}
                                onRemovePage={(id) => setPages((current) => current.filter((page) => page.id !== id))}
                                onReorderBlock={reorderBlock}
                                onDuplicateBlock={duplicateBlock}
                                onRemoveBlock={removeBlock}
                                onResizeBlock={resizeBlock}
                                pageNodes={pageRects}
                                registerRect={registerRect}
                            />

                            <div className='flex flex-col gap-3 p-4 rounded-2xl bg-neutral6 dark:bg-neutral5/40 border border-neutral4 overflow-y-auto no-scrollbar'>

                                <TextTabSelector
                                    tabs={TABS}
                                    currentIndex={TABS.findIndex((entry) => entry.name === tab)}
                                    onSelect={(entry) => setTab(entry.name)}
                                />

                                {problem ? <p role='status' className='p-3 rounded-xl bg-red-400/10 text-xs leading-5 text-red-500'>{problem}</p> : null}

                                {tab === 'palette' ? (
                                    <PaletteTab
                                        selectedElement={block?.type === 'interactive' ? block : null}
                                        onPlaceBlock={placeBlock}
                                        onAddShape={(kind) => addPart('shapes', newShape(kind, block.canvas, block.shapes.length, block.shapes.filter((shape) => shape.kind === 'curve').map((shape) => shape.id)))}
                                        onAddVariable={addVariable}
                                    />
                                ) : (
                                    <PropertiesTab
                                        block={block}
                                        variable={variable}
                                        pageVariables={page?.variables ?? []}
                                        selection={selection}
                                        onSelect={setSelection}
                                        onChangeBlock={changeBlock}
                                        onChangeVariable={changeVariable}
                                        onRemoveVariable={() => removeVariable(variable.id)}
                                        onAddReadout={() => addPart('readouts', newReadout(block.readouts.length))}
                                        onRemoveBlock={() => removeBlock(block.id)}
                                        onRemovePart={(key, id) => {
                                            changeBlock({ ...block, [key]: block[key].filter((entry) => entry.id !== id) })
                                            setSelection((current) => ({ ...current, partId: null }))
                                        }}
                                    />
                                )}

                            </div>

                        </div>

                        {/* The ghost follows the pointer so it is obvious what is being placed,
                            and where, before the drop happens. */}
                        <DragOverlay dropAnimation={null}>
                            {dragging ? (
                                <div className='px-3 py-2 rounded-xl bg-neutral6 dark:bg-neutral4 border border-sat1 shadow-lg shadow-shadow text-xs font-semibold text-neutral0'>
                                    {dragging.kind === 'new'
                                        ? `Place ${BLOCK_KINDS.find((entry) => entry.type === dragging.type)?.label ?? 'block'}`
                                        : 'Moving'}
                                </div>
                            ) : null}
                        </DragOverlay>

                    </DndContext>
                )}

            </div>

        </div>
    )
}

export default LessonBuilderPage
