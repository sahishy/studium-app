import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/contexts/AuthContext'
import { useModal } from '../../../shared/contexts/ModalContext'
import logoLarge from '../../../assets/images/logo_lg.png'
import heroImage from '../../../assets/images/landing/hero.jpg'
import logoLargeWhite from '../../../assets/images/logo_lg_white.png' 
import Button from '../../../shared/components/ui/Button'
import Card from '../../../shared/components/ui/Card'
import LogInModal from '../../auth/components/modals/LogInModal'

const Landing = () => {

    const { user, loading } = useAuth()
    const { openModal } = useModal()
    const navigate = useNavigate()
    const [scrollY, setScrollY] = useState(0)

    const openLogInModal = () => {
        openModal(
            <LogInModal
                onSwitchToSignUp={() => navigate('/welcome')}
            />
        )
    }

    const openWelcomePage = () => navigate('/welcome')

    const features = [
        {
            name: 'Agenda',
            header: 'Stay on top of everything.',
            content: 'Capture tasks instantly in a doc-like flow, break work down by class, and see what matters most at a glance so nothing sneaks up on you.'
        },
        {
            name: 'Courses',
            header: 'Choose classes smarter.',
            content: 'Browse real student feedback on workload, grading style, and teaching quality so you can build a schedule that fits your goals and your pace.'
        },
        {
            name: 'Circles',
            header: 'Study with your people.',
            content: 'Create invite-only groups with friends, share progress naturally, and keep each other consistent through the weeks that usually derail momentum.'
        },
        {
            name: 'Multiplayer',
            header: 'Compete. Improve. Repeat.',
            content: 'Turn practice into competitive matches with ranked progression, sharpen your skills under pressure, and stay motivated by seeing your growth in real time.'
        }
    ]

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
        <div className="relative min-h-screen overflow-x-hidden bg-background0 text-neutral0">
            <LandingBackground scrollY={scrollY} />

            <Navbar onOpenLogIn={openLogInModal} onOpenSignUp={openWelcomePage} />

            <main className='relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 pb-20 pt-24 md:gap-14 md:px-10'>
                <HeroSection onOpenLogIn={openLogInModal} onOpenSignUp={openWelcomePage} scrollY={scrollY} />

                {features.map((feature, index) => (
                    <FeatureSection
                        key={feature.name}
                        feature={feature}
                        reverse={index % 2 === 1}
                        scrollY={scrollY}
                    />
                ))}

                <FinalCTA onOpenSignUp={openWelcomePage} scrollY={scrollY} />

            </main>

            <Footer />
        </div>
    )

}

const LandingBackground = ({ scrollY }) => {

    const blobOffset = Math.min(32, scrollY * 0.035)

    return (
        <div className='pointer-events-none absolute left-0 right-0 top-0 z-0 h-screen overflow-visible'>
            <div
                className='absolute inset-0 opacity-20'
                style={{
                    backgroundImage: 'linear-gradient(to right, rgba(100,116,139,0.35) 1px, transparent 1px), linear-gradient(to bottom, rgba(100,116,139,0.35) 1px, transparent 1px)',
                    backgroundSize: '36px 36px'
                }}
            />
            <div className='absolute inset-0 bg-gradient-to-r from-background0 via-background0/45 to-background0' />
            <div className='absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background0' />

            <div
                className='absolute left-20 top-80 h-[26rem] w-[26rem] rounded-full bg-sky-200/20 blur-3xl'
                style={{ transform: `translate3d(${-blobOffset}px, ${blobOffset * 0.45}px, 0)` }}
            />
            <div
                className='absolute bottom-8 right-8 h-[28rem] w-[28rem] rounded-full bg-yellow-200/5 blur-3xl'
                style={{ transform: `translate3d(${blobOffset}px, ${-blobOffset * 0.4}px, 0)` }}
            />
            <div className='absolute left-1/2 top-1/3 h-80 w-80 -translate-x-1/2 rounded-full bg-violet-100/18 blur-3xl' />
        </div>
    )

}

const Navbar = ({ onOpenLogIn, onOpenSignUp }) => {

    const [visible, setVisible] = useState(false)

    useEffect(() => {
        const handleScroll = () => {
            setVisible(window.scrollY > 400)
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

                <div className='flex items-center gap-2 ml-2'>
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

    const maxTilt = 12
    const tilt = Math.max(0, maxTilt - (scrollY * 0.2))

    return (
        <section className='px-4 pb-8 pt-18 text-center md:px-8 md:pt-24'>
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

                <img
                    src={heroImage}
                    alt='Studium dashboard preview'
                    className='mt-12 w-full max-w-5xl rounded-2xl object-cover shadow-2xl shadow-shadow border border-neutral3 transition-transform duration-300'
                    style={{
                        transform: `perspective(1400px) rotateX(${tilt}deg)`,
                        transformOrigin: 'center top'
                    }}
                />
            </div>
        </section>
    )

}

const useScrollProgress = (scrollY) => {

    const sectionRef = useRef(null)
    const [progress, setProgress] = useState(0)

    useEffect(() => {
        const currentRef = sectionRef.current
        if (!currentRef) return

        const rect = currentRef.getBoundingClientRect()
        const viewportHeight = window.innerHeight || 1
        const raw = ((viewportHeight * 1.6) - rect.top) / (viewportHeight * 1.05)
        const clamped = Math.min(1, Math.max(0, raw))
        setProgress(clamped)
    }, [scrollY])

    return { sectionRef, progress }

}

const getSectionMotionStyle = (progress) => ({

    opacity: 0.3 + (progress * 0.7),
    transform: `translateY(${(1 - progress) * 32}px) scale(${0.98 + (progress * 0.02)})`

})

const FeaturePlaceholder = () => (

    <Card className='h-70 w-full justify-center bg-neutral5 md:h-80'>
        <div className='mx-auto flex w-full max-w-[240px] flex-col gap-3'>
            <div className='h-3 rounded-full bg-neutral3' />
            <div className='h-3 w-4/5 rounded-full bg-neutral3' />
            <div className='mt-3 h-26 rounded-xl bg-neutral4' />
            <div className='h-3 w-2/3 rounded-full bg-neutral3' />
        </div>
    </Card>

)

const FeatureSection = ({ feature, reverse = false, scrollY }) => {

    const { sectionRef, progress } = useScrollProgress(scrollY)

    return (
        <Card
            ref={sectionRef}
            className='min-h-[360px] rounded-3xl px-6 py-10 transition-[opacity,transform] duration-200 md:min-h-[390px] md:px-10 md:py-12'
            style={getSectionMotionStyle(progress)}
        >
            <div className={`grid items-center gap-8 md:grid-cols-2 ${reverse ? 'md:[&>*:first-child]:order-2' : ''}`}>
                <div>
                    <p className='text-sm font-semibold uppercase tracking-wide text-neutral1'>
                        {feature.name}
                    </p>
                    <h2 className='mt-2 text-3xl font-bold tracking-tight md:text-4xl'>
                        {feature.header}
                    </h2>
                    <p className='mt-4 max-w-xl text-base text-neutral1 md:text-lg'>
                        {feature.content}
                    </p>
                </div>

                <FeaturePlaceholder />
            </div>
        </Card>
    )

}

const FinalCTA = ({ onOpenSignUp, scrollY }) => {

    const { sectionRef, progress } = useScrollProgress(scrollY)

    return (
        <section
            ref={sectionRef}
            className='mb-6 mt-2 px-6 py-14 text-center transition-[opacity,transform] duration-200 md:px-10'
            style={getSectionMotionStyle(progress)}
        >
            <h2 className='text-4xl font-bold tracking-tight'>Start building momentum.</h2>
            <p className='mx-auto mt-4 max-w-2xl text-lg text-neutral1'>
                Everything you need to stay organized, motivated, and ahead.
            </p>

            <div className='mt-8 flex justify-center'>
                <Button
                    type='primary'
                    onClick={onOpenSignUp}
                >
                    Get started
                </Button>
            </div>
        </section>
    )

}

const Footer = () => {

    return (
        <footer className='relative w-full mt-16 h-96 bg-neutral0 flex items-center justify-center'>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 320" className='absolute -top-48'>
                <path fill="#1F2937" d="M0,160L60,149.3C120,139,240,117,360,128C480,139,600,181,720,176C840,171,960,117,1080,96C1200,75,1320,85,1380,90.7L1440,96L1440,320L1380,320C1320,320,1200,320,1080,320C960,320,840,320,720,320C600,320,480,320,360,320C240,320,120,320,60,320L0,320Z"></path>
            </svg>
            <div className='w-full max-w-6xl flex flex-col gap-3 items-center z-1 pb-8'>
                
                <img src={logoLargeWhite} className='w-48 h-16 object-contain'/>
                <p className='text-neutral1 text-sm'>© 2026 www.studium-app.com - All Rights Reserved.</p>

            </div>
        </footer>
    )

}

export default Landing;