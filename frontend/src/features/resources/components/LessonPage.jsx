import { useState } from 'react'
import { FaArrowUpRightFromSquare, FaChevronLeft, FaChevronRight } from 'react-icons/fa6'
import { PAGE_RATIO } from '../utils/elementDefaults.js'
import { formatTick } from '../utils/elementGeometry.js'
import InteractiveElement from './InteractiveElement'
import VariableControls from './VariableControls'

const QuizBlock = ({ block, draft = false }) => {

    const [answer, setAnswer] = useState(null)

    return (
        <section className='flex flex-col gap-2 h-full'>

            <h3 className='font-semibold text-neutral0'>
                {block.prompt || (draft ? <span className='text-neutral2'>Ask your question here</span> : null)}
            </h3>

            {block.options.map((option, index) => {

                const isPicked = answer === index
                const isCorrect = index === block.answerIndex

                return (
                    <button
                        key={index}
                        type='button'
                        onClick={() => setAnswer(index)}
                        className={`w-full px-4 py-2.5 rounded-xl text-left text-sm border transition-colors cursor-pointer
                            ${isPicked
                                ? isCorrect
                                    ? 'border-green-400 bg-green-400/15 text-green-500'
                                    : 'border-red-400 bg-red-400/15 text-red-500'
                                : 'border-neutral4 bg-neutral6 dark:bg-neutral4 hover:border-neutral3'}`}
                    >
                        {option || (draft ? <span className='text-neutral2'>{`Answer ${index + 1}`}</span> : null)}
                    </button>
                )
            })}

            {answer != null ? (
                <p role='status' className='text-sm text-neutral1'>
                    {answer === block.answerIndex ? 'Correct!' : `The answer is ${block.options[block.answerIndex]}.`} {block.explanation}
                </p>
            ) : null}

        </section>
    )
}

// Text can name a page variable in braces and show its live value, so a sentence can be the
// interactive part of a lesson without a chart anywhere near it.
const liveText = (text, variables, values) => String(text).replace(/\{([^}]{1,80})\}/g, (match, name) => {
    const variable = variables.find((entry) => entry.label?.toLowerCase() === name.trim().toLowerCase())
    if(!variable) return match
    const value = values[variable.id] ?? variable.value
    return variable.control === 'choice'
        ? variable.options.find((option) => option.value === value)?.label ?? formatTick(value)
        : formatTick(value)
})

// Placeholders are shown, never stored: a new block has to read as the thing it will become,
// but publishing must not quietly ship the example text.
const Ghosted = ({ children }) => <span className='text-neutral2'>{children}</span>

// One renderer for both the builder canvas and the reader, so what an author places is exactly
// what a reader gets. `draft` only adds the placeholders.
const LessonBlock = ({ block, draft = false, variables = [], values = {} }) => {

    if(block.type === 'text') {
        return (
            <p className='whitespace-pre-wrap text-sm leading-7 text-neutral0'>
                {block.text ? liveText(block.text, variables, values) : (draft ? <Ghosted>Write the explanation here.</Ghosted> : null)}
            </p>
        )
    }

    if(block.type === 'media') {
        return (
            <a
                href={block.url || undefined}
                target='_blank'
                rel='noopener noreferrer'
                className='flex items-center gap-2 px-4 py-3 rounded-2xl bg-neutral5 text-sm text-sky-500 hover:bg-neutral4 transition-colors'
            >
                {block.caption || block.url || (draft ? <Ghosted>Link a video or document</Ghosted> : null)} <FaArrowUpRightFromSquare className='text-xs' />
            </a>
        )
    }

    if(block.type === 'quiz') return <QuizBlock block={block} draft={draft} />

    return <InteractiveElement block={block} draft={draft} shared={variables} sharedValues={values} />
}

// Frames are percentages of the page, so the same page renders at any width.
const PlacedBlock = ({ block, variables, values, children }) => (
    <div
        className='absolute min-w-0'
        style={{ left: `${block.frame.x}%`, top: `${block.frame.y}%`, width: `${block.frame.w}%`, height: `${block.frame.h}%` }}
    >
        <div className='w-full h-full overflow-hidden'>{children ?? <LessonBlock block={block} variables={variables} values={values} />}</div>
    </div>
)

const LessonPage = ({ page, values = {}, className = '', children }) => (
    <div className={`relative w-full bg-neutral6 rounded-2xl shadow-lg shadow-shadow overflow-hidden ${className}`} style={{ aspectRatio: PAGE_RATIO }}>
        {page.blocks.map((block) => <PlacedBlock key={block.id} block={block} variables={page.variables} values={values} />)}
        {children}
    </div>
)

const LessonReader = ({ pages = [] }) => {

    const [index, setIndex] = useState(0)
    const [values, setValues] = useState({})
    const page = pages[index]

    if(!page) return null

    return (
        <div className='flex flex-col gap-3'>

            <div className='flex flex-col gap-3 p-4 rounded-3xl bg-neutral5'>
                <LessonPage page={page} values={values} />
                <VariableControls
                    variables={page.variables}
                    values={values}
                    onChange={(id, value) => setValues((current) => ({ ...current, [id]: value }))}
                />
            </div>

            {pages.length > 1 ? (
                <div className='flex items-center justify-center gap-3'>

                    <button type='button' aria-label='Previous page' disabled={index === 0} onClick={() => setIndex(index - 1)} className='p-2.5 rounded-full bg-neutral5 text-neutral0 cursor-pointer hover:bg-neutral4 disabled:opacity-40 disabled:cursor-default transition-colors'>
                        <FaChevronLeft className='text-xs' />
                    </button>

                    <p className='text-xs text-neutral1'>Page {index + 1} of {pages.length}</p>

                    <button type='button' aria-label='Next page' disabled={index === pages.length - 1} onClick={() => setIndex(index + 1)} className='p-2.5 rounded-full bg-neutral5 text-neutral0 cursor-pointer hover:bg-neutral4 disabled:opacity-40 disabled:cursor-default transition-colors'>
                        <FaChevronRight className='text-xs' />
                    </button>

                </div>
            ) : null}

        </div>
    )
}

export default LessonPage
export { LessonBlock, LessonReader, PlacedBlock }
