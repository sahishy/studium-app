import { createElement, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FaArrowRight, FaBook, FaBookOpen, FaBolt, FaCalendarDays, FaCheck, FaClock, FaGraduationCap, FaList, FaMagnifyingGlass, FaPlus, FaThumbsUp, FaTiktok, FaUserGroup } from 'react-icons/fa6'
import { RiInstagramFill } from 'react-icons/ri'
import { useAuth } from '../../auth/contexts/AuthContext'
import { useModal } from '../../../shared/contexts/ModalContext'
import logoLarge from '../../../assets/images/logo_lg.png'
import heroImage from '../../../assets/images/landing/hero.jpg'
import logoLargeWhite from '../../../assets/images/logo_lg_white.png'
import bronzeRank from '../../../assets/images/ranked/bronze_IV.svg'
import Button from '../../../shared/components/ui/Button'
import LogInModal from '../../auth/components/modals/LogInModal'

const Landing = () => {

    const { user, loading } = useAuth()
    const { openModal } = useModal()
    const navigate = useNavigate()
    const [scrollY, setScrollY] = useState(0)

    useGentleScroll()

    const openLogInModal = () => {
        openModal(
            <LogInModal
                onSwitchToSignUp={() => navigate('/welcome')}
            />
        )
    }

    const openWelcomePage = () => navigate('/welcome')

    useEffect(() => {
        if (!loading && user) {
            navigate('/agenda')
        }
    }, [user, loading, navigate])

    useEffect(() => {
        const handleScroll = () => setScrollY(window.scrollY)
        window.addEventListener('scroll', handleScroll, { passive: true })

        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    return (
        <div className="relative min-h-screen overflow-x-clip bg-neutral6 text-neutral0">
            <LandingBackground />

            <Navbar onOpenLogIn={openLogInModal} onOpenSignUp={openWelcomePage} />

            <main className='relative z-10 mx-auto flex w-full max-w-6xl flex-col px-6 pb-20 pt-24 md:px-10'>
                <HeroSection onOpenLogIn={openLogInModal} onOpenSignUp={openWelcomePage} scrollY={scrollY} />

                <UniversityMarquee />
                <PlanSection scrollY={scrollY} />
                <FeatureStory scrollY={scrollY} />
                <MultiplayerSection scrollY={scrollY} />
                <FinalCTA onOpenSignUp={openWelcomePage} scrollY={scrollY} />
            </main>

            <Footer />
        </div>
    )

}

const useGentleScroll = () => {

    useEffect(() => {
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
        const desktopPointer = window.matchMedia('(pointer: fine)')
        if (reducedMotion.matches || !desktopPointer.matches) return

        let target = window.scrollY
        let current = window.scrollY
        let frame = null

        const tick = () => {
            current += (target - current) * 0.14
            if (Math.abs(target - current) < 0.5) {
                current = target
                window.scrollTo(0, current)
                frame = null
                return
            }

            window.scrollTo(0, current)
            frame = window.requestAnimationFrame(tick)
        }

        const handleWheel = (event) => {
            if (event.ctrlKey || event.metaKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return

            event.preventDefault()
            const maximum = Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
            target = Math.min(maximum, Math.max(0, target + event.deltaY * 0.72))
            if (frame === null) frame = window.requestAnimationFrame(tick)
        }

        const syncScroll = () => {
            if (frame === null) {
                target = window.scrollY
                current = window.scrollY
            }
        }

        window.addEventListener('wheel', handleWheel, { passive: false })
        window.addEventListener('scroll', syncScroll, { passive: true })

        return () => {
            window.removeEventListener('wheel', handleWheel)
            window.removeEventListener('scroll', syncScroll)
            if (frame !== null) window.cancelAnimationFrame(frame)
        }
    }, [])

}

const LandingBackground = () => {

    return (
        <div className='pointer-events-none absolute left-0 right-0 top-0 z-0 h-screen overflow-visible'>
            <div
                className='absolute inset-0 opacity-20'
                style={{
                    backgroundImage: 'linear-gradient(to right, rgba(100,116,139,0.35) 1px, transparent 1px), linear-gradient(to bottom, rgba(100,116,139,0.35) 1px, transparent 1px)',
                    backgroundSize: '36px 36px'
                }}
            />
            <div className='absolute inset-0 bg-gradient-to-r from-neutral6 via-neutral6/45 to-neutral6' />
            <div className='absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-neutral6' />

        </div>
    )

}

const Navbar = ({ onOpenLogIn, onOpenSignUp }) => {

    const [visible, setVisible] = useState(false)

    useEffect(() => {
        const handleScroll = () => {
            setVisible(window.scrollY > 350)
        }

        window.addEventListener('scroll', handleScroll)
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    return (

        <div className='fixed top-4 z-50 w-full px-4'>

            <header
                className={`mx-auto flex w-full items-center justify-between overflow-visible rounded-full bg-neutral5/80 p-3 backdrop-blur-sm transition-all duration-300 ease-out
                    ${visible ? 'max-w-lg' : 'max-w-xs'}`}
            >

                <div className='ml-2 flex items-center gap-2'>
                    <img src={logoLarge} alt='Studium' className='h-6 w-24 object-contain' />
                </div>

                <div className='flex items-center text-sm'>
                    <Button
                        onClick={onOpenLogIn}
                        type='secondary'
                        className='rounded-full whitespace-nowrap'
                    >
                        Log In
                    </Button>

                    <div
                        className={`ml-2 overflow-hidden transition-all duration-300 ease-out ${visible ? 'w-22 opacity-100' : 'w-0 opacity-0'}`}
                    >
                        <Button
                            onClick={onOpenSignUp}
                            type='primary'
                            className='w-22 rounded-full whitespace-nowrap'
                            disabled={!visible}
                        >
                            Sign Up
                        </Button>
                    </div>
                </div>

            </header>

        </div>
    )

}

const HeroSection = ({ onOpenLogIn, onOpenSignUp, scrollY }) => {

    const stageRef = useRef(null)
    const [stageProgress, setStageProgress] = useState(0)

    useEffect(() => {
        const stage = stageRef.current
        if (!stage) return

        const rect = stage.getBoundingClientRect()
        const viewportHeight = window.innerHeight || 1
        const raw = ((viewportHeight * 0.36) - rect.top) / (viewportHeight * 0.58)
        setStageProgress(Math.min(1, Math.max(0, raw)))
    }, [scrollY])

    const easedProgress = 1 - Math.pow(1 - stageProgress, 3)
    const tilt = 12 * (1 - easedProgress)
    const scale = 0.82 + (easedProgress * 0.18)

    return (
        <section className='px-4 pt-18 text-center md:px-8 md:pt-24'>
            <div
                className='flex flex-col items-center'
                style={{ transform: `translateY(${Math.min(16, scrollY * 0.03)}px)` }}
            >
                <h1 className='max-w-4xl text-balance text-4xl font-extrabold tracking-tight md:text-6xl'>
                    Make studying fun.
                </h1>

                <p className='mt-4 max-w-2xl text-neutral1 md:text-lg'>
                    Stay organized, compete with friends, and build real study momentum.
                </p>

                <div className='mt-8 flex flex-wrap items-center justify-center gap-3'>
                    <Button
                        type='primary'
                        onClick={onOpenSignUp}
                    >
                        Get started
                    </Button>
                    <Button
                        type='secondary'
                        onClick={onOpenLogIn}
                    >
                        Learn more
                    </Button>
                </div>

            </div>

            <div ref={stageRef} className='relative mt-12 md:h-[135vh]'>
                <div className='flex w-full items-start justify-center md:sticky md:top-20 md:h-[calc(100vh-5rem)] md:items-center'>
                    <img
                        src={heroImage}
                        alt='Studium dashboard preview'
                        className='w-full max-w-[68rem] rounded-2xl border border-neutral3 object-cover shadow-2xl shadow-shadow transition-transform duration-200 ease-out will-change-transform motion-reduce:transition-none'
                        style={{
                            transform: `perspective(1400px) rotateX(${tilt}deg) scale(${scale})`,
                            transformOrigin: 'center top'
                        }}
                    />
                </div>
            </div>
        </section>
    )

}

const useScrollProgress = (scrollY, start = 1.18, distance = 0.92) => {

    const sectionRef = useRef(null)
    const [progress, setProgress] = useState(0)

    useEffect(() => {
        const currentRef = sectionRef.current
        if (!currentRef) return

        const rect = currentRef.getBoundingClientRect()
        const viewportHeight = window.innerHeight || 1
        const raw = ((viewportHeight * start) - rect.top) / (viewportHeight * distance)
        setProgress(Math.min(1, Math.max(0, raw)))
    }, [scrollY, start, distance])

    return { sectionRef, progress }

}

const UniversityMarquee = () => {

    const trackRef = useRef(null)
    const universities = [
        ['https://upload.wikimedia.org/wikipedia/commons/c/cc/Harvard_University_coat_of_arms.svg', 'Harvard'],
        ['https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/MIT_logo_2003-2023.svg/3840px-MIT_logo_2003-2023.svg.png', 'MIT'],
        ['https://identity.stanford.edu/wp-content/uploads/sites/3/2020/07/block-s-right.png', 'Stanford'],
        ['https://upload.wikimedia.org/wikipedia/commons/d/d0/Princeton_seal.svg', 'Princeton'],
        ['https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ1i3xBES5ZFIHmhXLTFezgPMwEs6Iag1CsJl_SVnAqzA&s=10', 'Yale'],
        ['https://www.wikicu.com/images/thumb/b/ba/BastardShield.png/300px-BastardShield.png', 'Columbia'],
        ['https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Cornell_University_seal.svg/250px-Cornell_University_seal.svg.png', 'Cornell'],
        ['https://1000logos.net/wp-content/uploads/2021/06/Duke-Blue-Devils-logo.png', 'Duke']
    ]

    useEffect(() => {
        const track = trackRef.current
        if (!track || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

        let frame
        let offset = 0
        const move = () => {
            const loopWidth = track.scrollWidth / 2
            offset = loopWidth > 0 ? (offset + 0.28) % loopWidth : 0
            track.style.transform = `translate3d(${-offset}px, 0, 0)`
            frame = window.requestAnimationFrame(move)
        }
        frame = window.requestAnimationFrame(move)
        return () => window.cancelAnimationFrame(frame)
    }, [])

    return (
        <section className='pt-28 md:pt-40'>
            <p className='text-center text-sm text-neutral1'>used by students who got into top universities</p>
            <div className='mt-8 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)] [-webkit-mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]'>
                <div ref={trackRef} className='flex w-max items-center will-change-transform'>
                    {[0, 1].map((copy) => (
                        <div key={copy} aria-hidden={copy === 1} className='flex shrink-0 items-center'>
                            {universities.map(([imgUrl, university]) => (
                                <div key={`${copy}-${university}`} className='flex items-center gap-3 px-8 sm:px-12'>
                                    <img src={imgUrl} alt={university} className='h-24 w-24 object-contain grayscale opacity-40' />
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )

}

const SectionIntro = ({ label, title, body, centered = true }) => (
    <div className={centered ? 'mx-auto max-w-2xl text-center' : 'max-w-lg'}>
        <p className='text-sm text-neutral1'>{label}</p>
        <h2 className='mt-3 text-balance text-3xl font-semibold tracking-tight md:text-5xl'>{title}</h2>
        <p className='mt-4 text-balance leading-7 text-neutral1 md:text-lg'>{body}</p>
    </div>
)

const PlanSection = ({ scrollY }) => {

    const { sectionRef, progress } = useScrollProgress(scrollY)
    const enter = Math.min(1, progress * 1.25)

    return (
        <section ref={sectionRef} className='relative pt-32 md:pt-44'>
            <SectionIntro
                label='your personal agenda'
                title='Write it down. Know what’s next.'
                body='Add homework in plain English. Studium sorts it by day, class, and study circle.'
            />

            <div
                className='mx-auto mt-16 max-w-4xl rounded-[1.75rem] border border-neutral4 bg-neutral5 p-3 shadow-xl shadow-shadow transition-[opacity,transform] duration-700 ease-out md:p-5'
                style={{ opacity: enter, transform: `translateY(${(1 - enter) * 28}px)` }}
            >
                <div className='overflow-hidden rounded-[1.25rem] border border-neutral4 bg-neutral6'>
                    <AgendaPreview />
                </div>
            </div>
        </section>
    )

}

const AgendaPreview = ({ compact = false }) => (
    <div className={compact ? 'p-4' : 'p-5 md:p-8'}>
        <div className='flex items-start justify-between gap-4'>
            <div className='flex items-center gap-3'>
                <span className='rounded-xl bg-neutral5 p-2 text-sm text-neutral1'><FaBookOpen /></span>
                <p className={compact ? 'text-base font-semibold' : 'text-xl font-semibold'}>Agenda</p>
            </div>
            <div className='flex items-center gap-1 rounded-full bg-neutral5 p-1 text-neutral1'>
                <span className='rounded-full bg-neutral6 px-3 py-2 text-neutral0 shadow-sm'><FaList size={10} /></span>
                <span className='px-3 py-2'><FaCalendarDays size={10} /></span>
            </div>
        </div>

        <div className={compact ? 'mt-5' : 'mt-8'}>
            <div className='mb-2 flex items-center justify-between px-3 text-xs font-semibold'>
                <span>Today</span><span className='text-neutral1'>3 tasks</span>
            </div>
            {[
                ['Finish problem set 7', 'Calculus', '4:00 PM'],
                ['Review cellular respiration', 'AP Biology', '7:30 PM'],
                ['Draft essay introduction', 'English', 'Tomorrow']
            ].map(([task, course, time], index) => (
                <div key={task} className={`group flex items-center gap-3 rounded-xl px-3 text-sm hover:bg-neutral5/40 ${compact && index === 2 ? 'hidden' : ''}`}>
                    <span className='flex h-4 w-4 shrink-0 items-center justify-center rounded-md border border-neutral2' />
                    <div className='flex min-w-0 flex-1 items-center gap-2 border-b border-neutral4 py-3'>
                        <span className='truncate'>{task}</span>
                        <span className='hidden shrink-0 rounded-lg bg-neutral5 px-2 py-1 text-[10px] text-neutral1 sm:inline'>{course}</span>
                        <span className='ml-auto hidden shrink-0 items-center gap-1 text-[10px] text-neutral1 sm:flex'><FaClock size={9} /> {time}</span>
                    </div>
                </div>
            ))}
            <div className='mt-2 flex items-center gap-3 px-3 py-3 text-sm text-neutral1'>
                <FaPlus size={10} /> Type a task
            </div>
        </div>
    </div>
)

const FeatureStory = ({ scrollY }) => {

    const storyRef = useRef(null)
    const [activeIndex, setActiveIndex] = useState(0)
    const features = [
        {
            icon: FaBook,
            label: 'courses',
            title: 'Pick classes with better info.',
            body: 'See the workload, teacher, and student rating before you add a class.',
            preview: <CoursePreview />
        },
        {
            icon: FaCheck,
            label: 'agenda',
            title: 'Keep every assignment in one list.',
            body: 'Tasks stay grouped by day and connected to the class they came from.',
            preview: <PlanPreview />
        },
        {
            icon: FaUserGroup,
            label: 'circles',
            title: 'Study with your friends.',
            body: 'Share tasks, build a circle streak, and see who is putting in the work.',
            preview: <CirclePreview />
        }
    ]

    useEffect(() => {
        const story = storyRef.current
        if (!story) return

        const rect = story.getBoundingClientRect()
        const viewportHeight = window.innerHeight || 1
        const trackLength = viewportHeight * 1.32
        const progress = Math.min(1, Math.max(0, ((viewportHeight * 0.17) - rect.top) / trackLength))
        setActiveIndex(Math.min(features.length - 1, Math.round(progress * (features.length - 1))))
    }, [scrollY, features.length])

    return (
        <section className='relative pt-40 md:pt-52'>
            <SectionIntro
                label='how it works'
                title='Your school stuff, together.'
                body='Classes, assignments, and friends stay connected from the start.'
            />

            <div ref={storyRef} className='mt-14 lg:grid lg:grid-cols-[0.72fr_1.28fr] lg:gap-14'>
                <div className='relative'>
                    <div className='absolute bottom-[33vh] left-0 top-[33vh] hidden w-1 -translate-x-1/2 rounded-full bg-neutral4 lg:block'>
                        <span
                            className='absolute left-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-neutral6 bg-neutral0 shadow-sm transition-[top] duration-500 ease-out will-change-[top] motion-reduce:transition-none'
                            style={{ top: `${activeIndex * 50}%` }}
                        />
                    </div>
                    {features.map(({ icon, label, title, body, preview }, index) => {
                        const active = activeIndex === index
                        return (
                            <article key={label} className='flex min-h-[48vh] items-center py-12 lg:min-h-[66vh] lg:py-0'>
                                <div className={`relative pl-8 transition-[opacity,transform] duration-500 ease-out ${active ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-40'}`}>
                                    <div className='flex items-center gap-2 text-sm text-neutral1'>
                                        {createElement(icon, { size: 12 })}
                                        <span>{label}</span>
                                    </div>
                                    <h3 className='mt-4 text-2xl font-semibold tracking-tight md:text-3xl'>{title}</h3>
                                    <p className='mt-3 max-w-sm leading-7 text-neutral1'>{body}</p>
                                    <div className='mt-8 rounded-[1.5rem] bg-neutral5 p-3 lg:hidden'>{preview}</div>
                                </div>
                            </article>
                        )
                    })}
                </div>

                <div className='sticky top-24 hidden h-[72vh] items-center lg:flex'>
                    <div className='relative h-[min(36rem,70vh)] w-full overflow-hidden rounded-[1.75rem] border border-neutral4 bg-neutral5 p-8'>
                        <div className='absolute left-8 top-7 text-sm text-neutral1'>{features[activeIndex].label}</div>
                        {features.map(({ label, preview }, index) => (
                            <div key={label} className={`pointer-events-none absolute inset-0 flex items-center justify-center p-10 pt-16 transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-none ${activeIndex === index ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-4 scale-[0.985] opacity-0'}`}>
                                <div className='w-full max-w-xl'>{preview}</div>
                            </div>
                        ))}
                        <div className='absolute bottom-7 left-8 flex items-center gap-2'>
                            {features.map(({ label }, index) => <span key={label} className={`h-1.5 rounded-full transition-all duration-500 ${activeIndex === index ? 'w-7 bg-neutral0' : 'w-1.5 bg-neutral2'}`} />)}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )

}

const CoursePreview = () => (
    <div className='w-full rounded-2xl border border-neutral4 bg-neutral6 p-4 shadow-lg shadow-shadow transition-transform duration-700 ease-out'>
        <div className='flex items-center justify-between gap-3'>
            <div className='flex items-center gap-2'><span className='rounded-lg bg-neutral5 p-2 text-neutral1'><FaGraduationCap size={11} /></span><p className='text-sm font-semibold'>All Courses</p></div>
            <div className='hidden rounded-full bg-neutral5 p-1 text-[9px] sm:flex'><span className='px-3 py-1 text-neutral1'>My Courses</span><span className='rounded-full bg-neutral6 px-3 py-1 shadow-sm'>All Courses</span></div>
        </div>
        <div className='mx-auto mt-5 flex max-w-56 items-center gap-2 rounded-full bg-neutral5 px-4 py-2 text-[10px] text-neutral1'><FaMagnifyingGlass /> Search courses...</div>
        <div className='mt-4 grid grid-cols-3 gap-2'>
            {[
                ['Calculus II', 'Mathematics', '92%'],
                ['AP Biology', 'Science', '88%'],
                ['English 11', 'English', '95%']
            ].map(([title, subject, score]) => (
                <div key={title} className='min-w-0 rounded-xl border border-neutral4 bg-neutral6 p-1.5 shadow-sm'>
                    <div className='flex h-14 items-center justify-center rounded-lg bg-neutral5 text-neutral2'><FaBook /></div>
                    <div className='px-1 pb-1 pt-2'><p className='truncate text-[10px] font-semibold'>{title}</p><p className='mt-1 flex items-center gap-1 truncate text-[8px] text-neutral1'>{subject} · <FaThumbsUp size={7} /> {score}</p></div>
                </div>
            ))}
        </div>
    </div>
)

const PlanPreview = () => (
    <div className='w-full rounded-2xl border border-neutral4 bg-neutral6 shadow-lg shadow-shadow transition-transform duration-700 ease-out'>
        <AgendaPreview compact />
    </div>
)

const CirclePreview = () => (
    <div className='w-full rounded-2xl border border-neutral4 bg-neutral6 p-4 shadow-lg shadow-shadow transition-transform duration-700 ease-out'>
        <div className='flex items-center justify-between'><div className='flex items-center gap-2'><span className='rounded-lg bg-neutral5 p-2 text-neutral1'><FaUserGroup size={11} /></span><p className='text-sm font-semibold'>Socials</p></div><button className='rounded-full border border-neutral4 px-3 py-1.5 text-[9px] font-semibold'>Join Circle</button></div>
        <p className='mb-2 mt-5 text-[10px] font-semibold'>Circles</p>
        <div className='rounded-xl border border-neutral4 p-3 shadow-sm'>
            <div className='flex items-center gap-3'>
                <div className='flex h-14 w-14 items-center justify-center rounded-xl bg-neutral5'><FaBookOpen className='text-neutral1' /></div>
                <div className='min-w-0 flex-1'><div className='flex items-center gap-2'><p className='truncate text-xs font-semibold'>Finals focus</p><span className='rounded-lg bg-neutral5 px-2 py-1 text-[7px] text-neutral1'>study</span></div><p className='mt-1 flex items-center gap-1 text-[9px] text-neutral1'><FaBookOpen size={8} /> 12 tasks</p><p className='mt-1 flex items-center gap-1 text-[9px] text-neutral1'><FaUserGroup size={8} /> 6 members</p></div>
            </div>
            <div className='mt-3 flex items-center gap-3'><span className='text-[8px] font-semibold text-neutral1'>Lv. 4</span><div className='h-2 flex-1 overflow-hidden rounded-full bg-neutral5'><div className='h-full w-3/5 rounded-full bg-neutral1' /></div><span className='text-[8px] text-neutral1'>200 xp left</span></div>
            <div className='mt-3 flex -space-x-2'>{['M', 'S', 'Y'].map((letter) => <span key={letter} className='flex h-7 w-7 items-center justify-center rounded-full border-2 border-neutral6 bg-neutral4 text-[8px] font-semibold'>{letter}</span>)}</div>
        </div>
    </div>
)

const MultiplayerSection = ({ scrollY }) => {

    const { sectionRef, progress } = useScrollProgress(scrollY, 1.08, 0.95)
    const enter = Math.min(1, progress * 1.2)

    return (
        <section ref={sectionRef} className='relative pt-36 md:pt-52'>
            <div className='grid items-center gap-12 lg:grid-cols-[0.8fr_1.2fr]'>
                <SectionIntro
                    centered={false}
                    label='competitive multiplayer games'
                    title='Practice. Play. Rank up.'
                    body='Play quick SAT games, climb the ranks, and see how much better you’re getting.'
                />

                <div className='relative flex justify-center min-h-[460px] overflow-hidden rounded-[1.75rem] border border-neutral3 bg-neutral5 p-5 md:p-8'>
                    <div
                        className='min-h-[390px] flex items-center gap-5 transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-none sm:grid-cols-[1fr_0.8fr]'
                        style={{ transform: `translate3d(0, ${(1 - enter) * 38}px, 0)`, opacity: enter }}
                    >
                        <div className='flex flex-col gap-3 w-64'>
                            <div className='relative flex flex-col items-center rounded-2xl border border-neutral4 bg-neutral6 p-5 shadow-lg shadow-shadow'>
                                <div className='absolute -top-5 flex items-center gap-2 rounded-xl border border-neutral4 bg-neutral6 px-4 py-2 text-[10px] font-semibold shadow-sm'><FaBolt /> SAT Ranked</div>
                                <img src={bronzeRank} alt='Bronze rank' className='mt-2 h-20 w-20 object-contain' />
                                <p className='mt-1 text-lg font-semibold'>Bronze IV</p>
                                <div className='mt-4 h-3 w-full overflow-hidden rounded-full bg-neutral5'><div className='h-full w-3/5 rounded-full bg-neutral1' /></div>
                                <div className='mt-2 flex w-full justify-between text-[9px]'><span className='font-semibold'>236 <span className='text-neutral1'>SAT</span></span><span className='text-neutral1'>64 to Silver I</span></div>
                            </div>
                            <div className='flex gap-2'><div className='flex flex-1 items-center justify-center rounded-2xl border border-neutral0 border-b-4 bg-neutral0 py-4 text-sm font-bold text-neutral6'>PLAY</div><div className='flex w-16 items-center justify-center rounded-2xl border border-neutral4 bg-neutral6'><FaBolt /></div></div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )

}

const FinalCTA = ({ onOpenSignUp, scrollY }) => {

    const { sectionRef, progress } = useScrollProgress(scrollY, 1.62, 1.05)

    return (
        <section
            ref={sectionRef}
            className='mb-14 mt-28 px-6 py-16 text-center transition-[opacity,transform] duration-700 md:mt-36 md:px-10'
            style={{ opacity: 0.55 + progress * 0.45, transform: `translateY(${(1 - progress) * 14}px)` }}
        >
            <h2 className='text-4xl font-semibold tracking-tight md:text-5xl'>Start building momentum.</h2>
            <p className='mx-auto mt-4 max-w-2xl text-lg text-neutral1'>
                Everything you need to stay organized, motivated, and ahead.
            </p>

            <div className='mt-8 flex justify-center'>
                <Button type='primary' onClick={onOpenSignUp} className='group'>
                    Get started <FaArrowRight className='text-xs transition-transform group-hover:translate-x-0.5' />
                </Button>
            </div>
        </section>
    )

}

const Footer = () => {

    const preventDummyNavigation = (event) => event.preventDefault()

    const footerColumns = [
        {
            title: 'Socials',
            links: [
                { label: 'Instagram', href: '#' },
                { label: 'TikTok', href: '#' },
            ],
        },
        {
            title: 'Links',
            links: [
                { label: 'About', href: '#' },
                { label: 'Contact', href: '#' },
            ],
        },
        {
            title: 'Info',
            links: [
                { label: 'Terms of service', href: '#' },
                { label: 'Privacy policy', href: '#' },
            ],
        },
    ]

    return (
        <footer className='relative mt-16 min-h-[28rem] w-full bg-neutral0 px-6 pb-10 pt-16 text-neutral6 md:px-10'>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 320" className='absolute -top-64 -left-24'>
                <path fill="#1F2937" d="M0,160L60,149.3C120,139,240,117,360,128C480,139,600,181,720,176C840,171,960,117,1080,96C1200,75,1320,85,1380,90.7L1440,96L1440,320L1380,320C1320,320,1200,320,1080,320C960,320,840,320,720,320C600,320,480,320,360,320C240,320,120,320,60,320L0,320Z"></path>
            </svg>
            <div className='relative z-1 mx-auto flex min-h-[12em] w-full max-w-6xl flex-col justify-between gap-14'>
                <div className='grid gap-12 md:grid-cols-[1fr_auto] md:items-start'>
                    <div>
                        <img src={logoLargeWhite} alt='Studium' className='h-11 w-36 object-contain object-left'/>
                        <div className='mt-4 flex items-center'>
                            <a href='https://www.instagram.com/' target='_blank' rel='noreferrer' aria-label='Instagram' className='flex h-9 w-9 items-center justify-center rounded-full text-neutral1 transition hover:text-white'>
                                <RiInstagramFill size={18} />
                            </a>
                            <a href='https://www.tiktok.com/' target='_blank' rel='noreferrer' aria-label='TikTok' className='flex h-9 w-9 items-center justify-center rounded-full text-neutral1 transition hover:text-white'>
                                <FaTiktok size={16} />
                            </a>
                        </div>
                    </div>

                    <div className='grid grid-cols-2 gap-x-12 gap-y-10 sm:grid-cols-3 sm:gap-x-16 md:gap-x-20'>
                        {footerColumns.map((column) => (
                            <div key={column.title}>
                                <p className='text-sm font-semibold text-white'>{column.title}</p>
                                <div className='mt-4 flex flex-col gap-3'>
                                    {column.links.map((link) => (
                                        <a
                                            key={link.label}
                                            href={link.href}
                                            target={link.href === '#' ? undefined : '_blank'}
                                            rel={link.href === '#' ? undefined : 'noreferrer'}
                                            onClick={link.href === '#' ? preventDummyNavigation : undefined}
                                            className='whitespace-nowrap text-sm text-neutral1 transition hover:text-white'
                                        >
                                            {link.label}
                                        </a>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <p className='text-sm text-neutral1'>© 2026 www.studium-app.com - All Rights Reserved.</p>
            </div>
        </footer>
    )

}

export default Landing
