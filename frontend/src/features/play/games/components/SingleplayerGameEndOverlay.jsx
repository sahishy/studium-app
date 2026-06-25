import Card from "../../../../shared/components/ui/Card"

const SingleplayerGameEndOverlay = ({
    title = 'Game Complete',
    subtitle = '',
    scoreLabel = 'Score',
    scoreDisplay = '00:00.00',
    bestScoreLabel = 'Best Score',
    bestScoreDisplay = '00:00.00',
    statusLabel = 'Run Complete',
    statusClassName = 'text-neutral0',
    reviewTitle = 'Question Review',
    reviewItems = [],
}) => {
    return (
        <div className='w-full h-full min-h-[420px] flex flex-col items-center px-6 py-10 overflow-y-auto'>
            <div className='text-center mb-8'>
                <p className='text-5xl font-bold text-sat0 leading-none mb-2'>{title}</p>
                {subtitle ? <p className='text-sm text-neutral1'>{subtitle}</p> : null}
            </div>

            <div className='w-full max-w-4xl mb-8 grid grid-cols-1 md:grid-cols-3 gap-4'>
                <Card className='items-center gap-2! p-6!'>
                    <p className='text-xs uppercase tracking-wide text-neutral1'>{scoreLabel}</p>
                    <p className='text-4xl font-bold tabular-nums'>{scoreDisplay}</p>
                </Card>

                <Card className='items-center gap-2! p-6!'>
                    <p className='text-xs uppercase tracking-wide text-neutral1'>{bestScoreLabel}</p>
                    <p className='text-4xl font-bold tabular-nums'>{bestScoreDisplay}</p>
                </Card>

                <Card className='items-center gap-2! p-6!'>
                    <p className='text-xs uppercase tracking-wide text-neutral1'>Result</p>
                    <p className={`text-2xl font-semibold ${statusClassName}`}>{statusLabel}</p>
                </Card>
            </div>

            <h2 className='text-2xl font-bold mt-4 mb-6 underline underline-offset-12 decoration-neutral2'>{reviewTitle}</h2>

            <div className='w-full max-w-4xl flex flex-col gap-3'>
                {reviewItems.map((item) => (
                    <Card key={item.id} className='w-full gap-1! p-5!'>
                        <p className='text-sm font-semibold'>{item.title}</p>
                        {item.subtitle ? <p className='text-xs text-neutral1'>{item.subtitle}</p> : null}
                        {item.detailRows?.map((row) => (
                            <p key={row.label} className='text-xs text-neutral1'>
                                {row.label}: {row.value}
                            </p>
                        ))}
                        {item.resultLabel ? (
                            <p className={`text-sm font-semibold ${item.resultClassName ?? 'text-neutral0'}`}>
                                {item.resultLabel}
                            </p>
                        ) : null}
                    </Card>
                ))}

                {!reviewItems.length ? (
                    <p className='text-center text-sm text-neutral1'>No questions found.</p>
                ) : null}
            </div>
        </div>
    )
}

export default SingleplayerGameEndOverlay