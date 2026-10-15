import { useEffect, useMemo, useRef, useState } from 'react'
import AvatarModel from '../../../shared/components/avatar/AvatarModel'
import Title from '../../profile/components/Title'
import PlayerLevel from '../../profile/components/PlayerLevel'
import { getRankInfoFromElo } from '../../profile/utils/statsUtils'
import bannerBackground from '../../../assets/images/bannerBackground.png'
import bannerMask from '../../../assets/images/bannerMask.png'

import { getGameServerNow } from '../services/realtimeSocketService'
import { getMatchIntroOffset, INTRO_SLIDE_IN_MS, INTRO_FADE_OUT_MS, getMatchIntroTiming } from '../utils/matchIntroTiming'

const PlayerBanner = ({ player, side, phase, modeId, placed, driftMs }) => {

    const elo = Number(player?.eloByMode?.[modeId] ?? player?.elo) || 0
    const rank = getRankInfoFromElo(elo, { placed })
    const offset = getMatchIntroOffset(phase, side)
    const slideInMs = INTRO_SLIDE_IN_MS
    const duration = phase === 'settle' ? driftMs : slideInMs
    const easing = phase === 'settle' ? 'linear' : 'cubic-bezier(0.22, 1, 0.36, 1)'

    return (
        <div
            className={`relative w-[108%] sm:w-[54%] shrink-0 min-w-0 ${side === 'local' ? '-ml-[4%] self-start' : '-mr-[4%] self-end'}`}
            style={{
                transform: `translateX(${offset}%)`,
                opacity: phase === 'enter' ? 0 : 1,
                transition: `transform ${duration}ms ${easing}, opacity ${slideInMs}ms linear`,
            }}
        >
            <div className='relative isolate aspect-[2/1] w-full'>
                <div className={`absolute -top-[5%] aspect-[2/1] w-[110%] ${side === 'local' ? 'left-0' : 'right-0'}`}>
                    <img src={bannerBackground} alt='' aria-hidden='true'
                        className='pointer-events-none absolute inset-0 h-full w-full'
                        style={{
                            // Mirroring the opponent artwork also mirrors its outer-edge fade.
                            maskImage: 'linear-gradient(to right, transparent, #000 25%)',
                            WebkitMaskImage: 'linear-gradient(to right, transparent, #000 25%)',
                            transform: side === 'opponent' ? 'scaleX(-1)' : undefined,
                        }} />

                    {/* Both assets use the same 1024 × 512 artboard. The mask's opaque lower
                        region is subtracted from a full mask, leaving the upper canvas visible.
                        The lower two thirds match the background artboard exactly; the upper
                        extension lets the raised character stand above it without clipping. */}
                    <div className='pointer-events-none absolute -top-1/2 bottom-0 inset-x-0 z-10'
                        style={{
                            maskImage: `linear-gradient(#000, #000), url("${bannerMask}")`,
                            maskSize: '100% 100%, 100% 66.666667%',
                            maskPosition: '0 0, 0 100%',
                            maskRepeat: 'no-repeat',
                            maskMode: 'alpha',
                            maskComposite: 'exclude',
                            WebkitMaskImage: `linear-gradient(#000, #000), url("${bannerMask}")`,
                            WebkitMaskSize: '100% 100%, 100% 66.666667%',
                            WebkitMaskPosition: '0 0, 0 100%',
                            WebkitMaskRepeat: 'no-repeat',
                            WebkitMaskComposite: 'xor',
                            // The PNG's last row is partly transparent; trim its subpixel seam.
                            clipPath: 'inset(0 0 2px 0)',
                            transform: side === 'opponent' ? 'scaleX(-1)' : undefined,
                        }}>
                        <div className='absolute bottom-0 inset-x-0 h-2/3'>
                            {/* Inverse dimensions preserve the character size as the artboard grows 10%. */}
                            <div className='absolute bottom-[3%] left-0 h-[113.636364%] w-[54.545455%]'
                                style={{ transform: side === 'opponent' ? 'scaleX(-1)' : undefined }}>
                                <AvatarModel
                                    profile={{ profile: {
                                        displayName: player?.displayName,
                                        profilePicture: player?.profilePicture,
                                        avatar: player?.avatar,
                                    } }}
                                    animation='Fight'
                                    rotation={[0, side === 'local' ? Math.PI / 6 : -Math.PI / 6, 0]}
                                    interactive={false}
                                    cameraPosition={[0, 0.8, 7]}
                                    className='h-full! w-full! max-w-none!'
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className='relative z-20 mx-auto -mt-[8%] flex w-[72%] min-w-0 flex-col items-center gap-1 text-center'>

                <p className='max-w-full truncate text-lg sm:text-xl lg:text-2xl font-semibold text-neutral0'>
                    {player?.displayName || 'Player'}
                </p>

                <Title titleId={player?.title} size='sm' className='[&.text-neutral1]:text-neutral1' />

                <div className='mt-0.5 flex flex-wrap justify-center items-center gap-1.5 sm:gap-2'>
                    <img src={rank.imageSrc} alt='' className='size-4 sm:size-6 object-cover' />
                    <span className='text-xs sm:text-sm font-semibold text-neutral1 tabular-nums'>
                        {placed ? <>{elo} <span className='text-[9px] font-medium text-neutral1'>SAT</span></> : 'Unranked'}
                    </span>
                    <PlayerLevel level={player?.level} className='sm:ml-2 text-neutral1!' />
                </div>

            </div>

        </div>
    )
}

const MatchIntroOverlay = ({ players = [], userId, roomId, modeId, introEndsAt = 0, placementByUserId = {} }) => {

    const [phase, setPhase] = useState('enter')
    const [done, setDone] = useState(false)
    const [driftMs, setDriftMs] = useState(0)
    const timersRef = useRef([])

    const { localPlayer, opponent } = useMemo(() => ({
        localPlayer: players.find((player) => player.userId === userId) ?? players[0] ?? null,
        opponent: players.find((player) => player.userId !== userId) ?? null,
    }), [players, userId])

    // A refresh mid-match must not replay the intro, so a room that has already shown it is
    // remembered for the tab's lifetime.
    const storageKey = introEndsAt ? `matchIntro:${introEndsAt}` : null

    useEffect(() => {

        if(!storageKey) return undefined

        let alreadyPlayed = false
        if(storageKey) {
            try { alreadyPlayed = window.sessionStorage.getItem(storageKey) === 'done' } catch { /* private mode */ }
        }

        // Use the same clock as gameplay and end precisely when its countdown starts.
        // A late join with too little time skips the intro rather than covering live play.
        const timing = getMatchIntroTiming(introEndsAt, getGameServerNow(roomId))
        if(alreadyPlayed || !timing) {
            setDone(true)
            return undefined
        }

        setDone(false)
        setPhase('enter')
        setDriftMs(timing.driftMs)

        const schedule = (fn, delay) => { timersRef.current.push(window.setTimeout(fn, delay)) }

        schedule(() => setPhase('drift'), timing.enterAtMs)
        schedule(() => setPhase('settle'), timing.settleAtMs)
        schedule(() => setPhase('fade'), timing.fadeAtMs)
        schedule(() => {
            setDone(true)
            // Marked played only once it has actually finished. Setting it up front meant
            // StrictMode's second pass in development read its own flag and skipped the
            // animation entirely - the intro never ran a single time.
            if(storageKey) {
                try { window.sessionStorage.setItem(storageKey, 'done') } catch { /* private mode */ }
            }
        }, timing.doneAtMs)

        return () => {
            timersRef.current.forEach((timer) => window.clearTimeout(timer))
            timersRef.current = []
        }

    }, [introEndsAt, storageKey, roomId])

    if(done || !localPlayer) return null

    const overlay = (
        <div
            // The avatar contexts only live for the intro window. They are unmounted hard once
            // `done` flips rather than left hidden, because stacking avatar canvases is what has
            // crashed a GPU context on this app before (see the note in Leaderboards.jsx).
            className='pointer-events-none absolute z-50 inset-0 flex items-center justify-center overflow-hidden bg-neutral6'
            // The background fades at the same speed as the banners, throughout the intro.
            style={{ opacity: phase === 'fade' ? 0 : 1, transition: `opacity ${INTRO_FADE_OUT_MS}ms` }}
            aria-hidden='true'
        >
            <div className='relative flex flex-col sm:flex-row w-full items-center justify-between gap-28 sm:gap-0'>
                <PlayerBanner
                    player={localPlayer}
                    side='local'
                    phase={phase}
                    driftMs={driftMs}
                    modeId={modeId}
                    placed={placementByUserId?.[localPlayer.userId]?.placed ?? true}
                />
                {opponent ? (
                    <PlayerBanner
                        player={opponent}
                        side='opponent'
                        phase={phase}
                        driftMs={driftMs}
                        modeId={modeId}
                        // A bot is indistinguishable from a human here by design: the server strips
                        // isBot from every snapshot, and the rank icon is what tells the player how
                        // hard this placement opponent is meant to be.
                        placed={placementByUserId?.[opponent.userId]?.placed ?? true}
                    />
                ) : null}
            </div>
        </div>
    )
    return overlay
}

export default MatchIntroOverlay
