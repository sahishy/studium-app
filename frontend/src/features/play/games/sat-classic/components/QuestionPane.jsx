import HtmlContent from '../../../../../shared/components/ui/HtmlContent'
import ChoiceButton from './ChoiceButton'
import { FaCalculator } from 'react-icons/fa6'

const DASHES = Array.from({ length: 12 }, (_, i) => i)

const QuestionPane = ({ gameState, currentQuestion, submittedResponse, isSprQuestion, isCalculatorOpen, onToggleCalculator, isBusy, hasAnswered, onChoiceSelect, onResponseChange, onSubmit }) => {

    const normalizedResponse = String(submittedResponse ?? '').trim()
    const normalizedResponseUpper = normalizedResponse.toUpperCase()
    const module = String(currentQuestion?.module ?? '').toLowerCase()
    const isMathQuestion = module === 'math'
    const isMathMcq = module === 'math' && !isSprQuestion
    const hasValidResponse = normalizedResponse.length > 0

    const contentSection = (
        <div className='flex-1 flex flex-col min-h-0 pl-6'>
            <div className={`flex flex-col ${isMathMcq && !isCalculatorOpen ? 'items-center text-center' : 'items-start'} bg-neutral5`}>
                <div className='w-full h-full flex justify-between'>
                    <div className='bg-neutral0 text-neutral6 px-2 py-1'>
                        {(gameState?.questionIndex ?? 0) + 1}
                    </div>
                    {isMathQuestion ? (
                        <button
                            type='button'
                            onClick={onToggleCalculator}
                            className={`p-2 cursor-pointer ${isCalculatorOpen ? 'text-neutral0' : 'text-neutral1 hover:text-neutral0'} transition`}
                        >
                            <FaCalculator />
                        </button>
                    ) : null}
                </div>

                <div className='flex gap-1 w-full border-t border-t-transparent'>
                    {DASHES.map((n) => (
                        <div key={n} className='flex-1 h-[3px] bg-neutral0' />
                    ))}
                </div>
            </div>

            <div className='relative flex-1 min-h-0'>
                <div className={`h-full overflow-y-auto overflow-x-visible px-1 flex flex-col gap-6 py-6 ${isMathMcq && !isCalculatorOpen ? 'items-center text-center' : ''}`}>
                    {currentQuestion?.body ? (
                        <HtmlContent html={currentQuestion.body} />
                    ) : null}

                    <HtmlContent html={currentQuestion?.prompt || 'Loading question...'} />

                    {isSprQuestion ? (
                        <div className='relative max-w-24 flex items-center justify-center'>
                            <input
                                type='text'
                                value={submittedResponse ?? ''}
                                onChange={(event) => onResponseChange?.(event.target.value)}
                                disabled={isBusy}
                                className='text-center w-full rounded-xl border border-neutral0 bg-neutral6 p-3 text-neutral0 focus:outline-none focus:ring-2 focus:ring-sat0 disabled:opacity-60'
                            />   
                            <hr className='absolute bottom-2 w-18 border-neutral0'/>                         
                        </div>

                    ) : (
                        <div className='flex flex-col gap-3 w-full'>
                            {(currentQuestion?.choices ?? []).map((choice) => (
                                <ChoiceButton
                                    key={choice.id}
                                    choice={choice}
                                    isSelected={normalizedResponseUpper === choice.id}
                                    isDisabled={isBusy}
                                    onSelect={onChoiceSelect}
                                />
                            ))}
                        </div>
                    )}
                </div>

                <div className='pointer-events-none absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-neutral6 to-transparent z-10' />
                <div className='pointer-events-none absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-neutral6 to-transparent z-10' />
            </div>

            <button
                type='button'
                onClick={onSubmit}
                disabled={!hasValidResponse || isBusy}
                className='w-full rounded-full bg-sat0 text-white p-3 font-semibold cursor-pointer transition disabled:opacity-50 disabled:cursor-not-allowed hover:not-disabled:bg-sat1'
            >
                {hasAnswered ? 'Waiting for opponent...' : 'Submit'}
            </button>
        </div >
    )

    return (
        <>
            {isSprQuestion ? (
                <>
                    <div className='relative flex-1 min-h-0 h-full overflow-y-auto pr-3'>
                        <FreeResponseDirections />
                    </div>

                    <hr className='border-2 border-neutral1 h-full rounded-full' />

                    {contentSection}
                </>
            ) : isMathMcq ? (
                isCalculatorOpen ? (
                    <>
                        <div className='flex-1 min-h-0 h-full pr-3' />
                        {contentSection}
                    </>
                ) : (
                    <div className='w-full max-w-xl mx-auto flex min-h-0'>
                        {contentSection}
                    </div>
                )
            ) : (
                <>
                    <div className='relative flex-1 min-h-0 h-full overflow-y-auto pr-3'>
                        <HtmlContent html={currentQuestion?.paragraph} />
                    </div>

                    <hr className='border-2 border-neutral1 h-full rounded-full' />

                    {contentSection}
                </>
            )}

        </>

    )

}

const FreeResponseDirections = () => {
    return (
        <div className="flex flex-col gap-6 mr-3">
            <div className="flex flex-col gap-3 text-sm">
                <h2 className="font-semibold text-lg">
                    Student-produced response directions
                </h2>

                <ul className="list-disc pl-5 space-y-1">
                    <li>If you find <span className='font-semibold'>more than one correct answer</span>, enter only one answer.</li>
                    <li>
                        You can enter up to 5 characters for a <span className='font-semibold'>positive</span> answer and up to 6
                        characters (including the negative sign) for a <span className='font-semibold'>negative</span> answer.
                    </li>
                    <li>
                        If your answer is a <span className='font-semibold'>fraction</span> that doesn't fit in the provided space,
                        enter the decimal equivalent.
                    </li>
                    <li>
                        If your answer is a <span className='font-semibold'>decimal</span> that doesn't fit in the provided space,
                        enter it by truncating or rounding at the fourth digit.
                    </li>
                    <li>
                        If your answer is a <span className='font-semibold'>mixed number</span> (such as <span className='font-semibold'>3 1/2</span>), enter it as an
                        improper fraction (7/2) or its decimal equivalent (3.5).
                    </li>
                    <li>
                        Don't enter <span className='font-semibold'>symbols</span> such as a percent sign, comma, or dollar sign.
                    </li>
                </ul>
            </div>

            <div className="flex flex-col gap-1">
                <h1 className="text-sm self-center">Examples</h1>

                <table className="w-full border border-black border-collapse text-center">
                    <thead>
                        <tr className="border border-black">
                            <th className="border border-black px-4 py-4 text-sm font-normal">
                                Answer
                            </th>
                            <th className="border border-black px-4 py-4 text-sm font-normal">
                                Acceptable way to enter answer
                            </th>
                            <th className="border border-black px-4 py-4 text-sm font-normal">
                                Unacceptable: will NOT receive credit
                            </th>
                        </tr>
                    </thead>

                    <tbody className="text-sm">

                        <tr className="border border-black">
                            <td className="border border-black px-3 py-6 font-semibold">3.5</td>
                            <td className="border border-black px-3 py-4 leading-relaxed">
                                <div>3.5</div>
                                <div>3.50</div>
                                <div>7/2</div>
                            </td>
                            <td className="border border-black px-3 py-4 leading-relaxed">
                                <div>31/2</div>
                                <div>3 1/2</div>
                            </td>
                        </tr>

                        <tr className="border border-black">
                            <td className="border border-black px-3 py-6 font-semibold">
                                <span className="inline-flex flex-col items-center leading-none">
                                    <span>2</span>
                                    <span className="border-t border-black px-1">3</span>
                                </span>
                            </td>
                            <td className="border border-black px-3 py-4 leading-relaxed">
                                <div>2/3</div>
                                <div>.6666</div>
                                <div>.6667</div>
                                <div>0.666</div>
                                <div>0.667</div>
                            </td>
                            <td className="border border-black px-3 py-4 leading-relaxed">
                                <div>0.66</div>
                                <div>.66</div>
                                <div>0.67</div>
                                <div>.67</div>
                            </td>
                        </tr>

                        <tr className="border border-black">
                            <td className="border border-black px-3 py-6 font-semibold">
                                <span className="inline-flex items-center gap-1">
                                    <span>-</span>
                                    <span className="inline-flex flex-col items-center leading-none">
                                        <span>1</span>
                                        <span className="border-t border-black px-1">3</span>
                                    </span>
                                </span>
                            </td>
                            <td className="border border-black px-3 py-4 leading-relaxed">
                                <div>-1/3</div>
                                <div>-.3333</div>
                                <div>-0.333</div>
                            </td>
                            <td className="border border-black px-3 py-4 leading-relaxed">
                                <div>-.33</div>
                                <div>-0.33</div>
                            </td>
                        </tr>

                    </tbody>
                </table>
            </div>
        </div>
    )
}

export default QuestionPane
