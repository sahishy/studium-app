import AvatarPicture from "../../../../../shared/components/avatar/AvatarPicture"

const OVERLAY_DURATION_MS = 3000
const DAMAGE_COUNT_ANIMATION_MS = 1000
const DAMAGE_CANCEL_START_MS = 1000
const DAMAGE_CANCEL_DURATION_MS = 1000

const ResultOverlay = ({ activeOverlayMode, roundCountdown, roundOverlayRemainingMs, resultOverlay, nowMs, currentQuestion, players }) => {

    if(!activeOverlayMode) return null

    const resultOverlayRemainingMs = resultOverlay
        ? Math.max(0, resultOverlay.durationMs - (nowMs - resultOverlay.startedAtMs))
        : 0

    const isResultOverlayActive = resultOverlayRemainingMs > 0
    const activeOverlayRemainingMs = isResultOverlayActive
        ? resultOverlayRemainingMs
        : roundOverlayRemainingMs

    const activeOverlayDurationMs = isResultOverlayActive
        ? resultOverlay?.durationMs ?? OVERLAY_DURATION_MS
        : OVERLAY_DURATION_MS

    const overlayProgressRatio = Math.max(
        0,
        Math.min(1, activeOverlayRemainingMs / activeOverlayDurationMs)
    )

    const resultOverlayElapsedMs = isResultOverlayActive
        ? Math.max(0, resultOverlay.durationMs - resultOverlayRemainingMs)
        : 0

    const resultRevealProgress = Math.max(
        0,
        Math.min(1, resultOverlayElapsedMs / DAMAGE_COUNT_ANIMATION_MS)
    )

    const resultRevealEaseOut = 1 - Math.pow(1 - resultRevealProgress, 3)

    const overlayMyResult = resultOverlay?.myResult ?? null
    const overlayOpponentResult = resultOverlay?.opponentResult ?? null

    const myRawDamage = Number(overlayMyResult?.damageRaw) || 0
    const opponentRawDamage = Number(overlayOpponentResult?.damageRaw) || 0
    const bothCorrect = Boolean(overlayMyResult?.isCorrect) && Boolean(overlayOpponentResult?.isCorrect)
    const myAnsweredFirstMultiplier = Number(overlayMyResult?.answeredFirstMultiplier ?? 1)
    const opponentAnsweredFirstMultiplier = Number(overlayOpponentResult?.answeredFirstMultiplier ?? 1)

    const hasDamageDifference =
        activeOverlayMode === 'round_result' &&
        myRawDamage !== opponentRawDamage

    const cancelAnimProgress = hasDamageDifference
        ? Math.max(
            0,
            Math.min(
                1,
                (resultOverlayElapsedMs - DAMAGE_CANCEL_START_MS) / DAMAGE_CANCEL_DURATION_MS
            )
        )
        : 0

    const biggerDamage = Math.max(myRawDamage, opponentRawDamage)
    const smallerDamage = Math.min(myRawDamage, opponentRawDamage)
    const netDamage = Math.max(0, biggerDamage - smallerDamage)

    const myIsBigger = myRawDamage > opponentRawDamage
    const opponentIsBigger = opponentRawDamage > myRawDamage
    const isTransferPhase = hasDamageDifference && resultOverlayElapsedMs >= DAMAGE_CANCEL_START_MS

    const getAnimatedDamage = (rawDamage, isCorrect, isBiggerSide) => {
        if (!isCorrect) return 0

        if (!hasDamageDifference) {
            return Math.round(rawDamage * resultRevealEaseOut)
        }

        if (isBiggerSide) {
            return Math.round(
                Math.max(0, biggerDamage - (biggerDamage - netDamage) * cancelAnimProgress)
            )
        }

        return rawDamage
    }

    const getPlayerByUserId = (uid) =>
        players.find((player) => player?.userId === uid) ?? null

    const myOverlayPlayer = getPlayerByUserId(overlayMyResult?.userId)
    const opponentOverlayPlayer = getPlayerByUserId(overlayOpponentResult?.userId)

    const myDamageMotionClass = isTransferPhase && myIsBigger ? 'translate-x-90' : ''
    const opponentDamageMotionClass = isTransferPhase && opponentIsBigger ? '-translate-x-90' : ''

    const myDamageFadeStyle = isTransferPhase && !myIsBigger && hasDamageDifference
        ? { opacity: Math.max(0, 1 - cancelAnimProgress * 3) }
        : {}

    const opponentDamageFadeStyle = isTransferPhase && !opponentIsBigger && hasDamageDifference
        ? { opacity: Math.max(0, 1 - cancelAnimProgress * 3) }
        : {}

    return (

        <div className='absolute inset-0 z-20 pb-10 bg-neutral6/60 backdrop-blur-sm flex items-center justify-center'>
            <div className='pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-neutral6 to-transparent' />
            <div className='pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-neutral6 to-transparent' />
            <div className='pointer-events-none absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-neutral6 to-transparent' />
            <div className='pointer-events-none absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-neutral6 to-transparent' />

            <div className='text-center'>
                {activeOverlayMode === 'round_start' ? (
                    <>
                        <p className='text-6xl font-bold leading-none'>{roundCountdown}</p>
                        <p className='text-sm text-neutral1 mt-2'>Get ready...</p>
                    </>
                ) : (
                    <>
                        <p
                            className={`mb-1 text-3xl font-semibold transition-opacity ${overlayMyResult?.isCorrect ? 'text-sat0' : 'text-red-500'}`}
                            style={{ opacity: resultOverlayElapsedMs >= 1 ? 1 : 0.2 }}
                        >
                            {overlayMyResult?.isCorrect ? 'Correct' : 'Incorrect'}
                        </p>

                        <p className='mb-6 text-sm text-neutral1'>
                            The correct answer was {resultOverlay?.correctAnswer ?? '—'}.
                        </p>

                        <div className='w-[680px] max-w-[90vw] grid grid-cols-2 gap-10 items-start'>
                            <div className='flex flex-col gap-3 items-center text-center'>
                                <AvatarPicture
                                    profile={{ profile: { profilePicture: myOverlayPlayer?.profilePicture ?? null } }}
                                    className='w-12 h-12'
                                />

                                <div className='transition-opacity' style={myDamageFadeStyle}>
                                    <p
                                        className={`text-5xl font-semibold text-sat0 leading-none transition-all duration-400 ease-out ${myDamageMotionClass}`}
                                    >
                                        {getAnimatedDamage(
                                            myRawDamage,
                                            Boolean(overlayMyResult?.isCorrect),
                                            myIsBigger
                                        )}
                                    </p>
                                </div>

                                {overlayMyResult?.isCorrect ? (
                                    <div className='gap-2 flex flex-col text-xs'>
                                        <span
                                            className='text-neutral1 transition-all duration-300'
                                            style={{ opacity: resultOverlayElapsedMs >= 1 ? 1 : 0.2 }}
                                        >
                                            +{overlayMyResult?.baseDamage ?? 0} ({currentQuestion?.difficulty} Question)
                                        </span>

                                        <span
                                            className='text-neutral1 transition-all duration-300'
                                            style={{
                                                opacity: resultOverlayElapsedMs >= 250 ? 1 : 0.2,
                                                transform: `translateY(${resultOverlayElapsedMs >= 250 ? '0px' : '4px'})`,
                                            }}
                                        >
                                            {Number(overlayMyResult?.timeMultiplier ?? 1).toFixed(2)}x Speed Multiplier
                                        </span>

                                        <span
                                            className='text-neutral1 transition-all duration-300'
                                            style={{
                                                opacity: resultOverlayElapsedMs >= 500 ? 1 : 0.2,
                                                transform: `translateY(${resultOverlayElapsedMs >= 500 ? '0px' : '4px'})`,
                                            }}
                                        >
                                            {Number(overlayMyResult?.roundMultiplier ?? 1).toFixed(2)}x Round Multiplier
                                        </span>

                                        {bothCorrect && myAnsweredFirstMultiplier > 1 ? (
                                            <span
                                                className='text-neutral1 transition-all duration-300'
                                                style={{
                                                    opacity: resultOverlayElapsedMs >= 750 ? 1 : 0.2,
                                                    transform: `translateY(${resultOverlayElapsedMs >= 750 ? '0px' : '4px'})`,
                                                }}
                                            >
                                                {myAnsweredFirstMultiplier.toFixed(2)}x Answered First
                                            </span>
                                        ) : null}
                                    </div>
                                ) : (
                                    <span
                                        className='text-xs text-neutral1 transition-all duration-300'
                                        style={{ opacity: resultOverlayElapsedMs >= 1 ? 1 : 0.2 }}
                                    >
                                        +0 (Wrong Answer)
                                    </span>
                                )}
                            </div>

                            <div className='flex flex-col gap-3 items-center text-center'>
                                <AvatarPicture
                                    profile={{ profile: { profilePicture: opponentOverlayPlayer?.profilePicture ?? null } }}
                                    className='w-12 h-12'
                                />

                                <div className='transition-opacity' style={opponentDamageFadeStyle}>
                                    <p
                                        className={`text-5xl font-semibold ${opponentIsBigger && resultOverlayElapsedMs >= 1000 ? 'text-red-400' : 'text-sat0'} leading-none transition-all duration-400 ease-out ${opponentDamageMotionClass}`}
                                    >
                                        {getAnimatedDamage(
                                            opponentRawDamage,
                                            Boolean(overlayOpponentResult?.isCorrect),
                                            opponentIsBigger
                                        )}
                                    </p>
                                </div>

                                {overlayOpponentResult?.isCorrect ? (
                                    <div className='gap-2 flex flex-col text-xs'>
                                        <span
                                            className='text-neutral1 transition-all duration-300'
                                            style={{ opacity: resultOverlayElapsedMs >= 1 ? 1 : 0.2 }}
                                        >
                                            +{overlayOpponentResult?.baseDamage ?? 0} ({currentQuestion?.difficulty} Question)
                                        </span>

                                        <span
                                            className='text-neutral1 transition-all duration-300'
                                            style={{
                                                opacity: resultOverlayElapsedMs >= 250 ? 1 : 0.2,
                                                transform: `translateY(${resultOverlayElapsedMs >= 250 ? '0px' : '4px'})`,
                                            }}
                                        >
                                            {Number(overlayOpponentResult?.timeMultiplier ?? 1).toFixed(2)}x Speed Multiplier
                                        </span>

                                        <span
                                            className='text-neutral1 transition-all duration-300'
                                            style={{
                                                opacity: resultOverlayElapsedMs >= 500 ? 1 : 0.2,
                                                transform: `translateY(${resultOverlayElapsedMs >= 500 ? '0px' : '4px'})`,
                                            }}
                                        >
                                            {Number(overlayOpponentResult?.roundMultiplier ?? 1).toFixed(2)}x Round Multiplier
                                        </span>

                                        {bothCorrect && opponentAnsweredFirstMultiplier > 1 ? (
                                            <span
                                                className='text-neutral1 transition-all duration-300'
                                                style={{
                                                    opacity: resultOverlayElapsedMs >= 750 ? 1 : 0.2,
                                                    transform: `translateY(${resultOverlayElapsedMs >= 750 ? '0px' : '4px'})`,
                                                }}
                                            >
                                                {opponentAnsweredFirstMultiplier.toFixed(2)}x Answered First
                                            </span>
                                        ) : null}
                                    </div>
                                ) : (
                                    <span
                                        className='text-xs text-neutral1 transition-all duration-300'
                                        style={{ opacity: resultOverlayElapsedMs >= 1 ? 1 : 0.2 }}
                                    >
                                        +0 (Wrong Answer)
                                    </span>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>

            <div className='absolute left-5 right-5 bottom-4 h-1.5 overflow-hidden'>
                <div
                    className='h-full bg-neutral0 rounded-full transition-all duration-75 ease-linear'
                    style={{ width: `${overlayProgressRatio * 100}%` }}
                />
            </div>
        </div>

    )

}

export default ResultOverlay