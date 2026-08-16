import podiumLight from '../../../assets/images/podium.png'
import podiumDark from '../../../assets/images/podium_dark.png'
import podiumGlow from '../../../assets/images/podium_glow.png'

const Podium = ({ className, fadeBottom = false, glow = false }) => {

    const fadeStyle = fadeBottom ? {
        maskImage: 'linear-gradient(to bottom, black 0%, black 58%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 58%, transparent 100%)',
    } : undefined

    // return (
    //     <>
    //         <img src={podiumLight} className={`dark:hidden ${className}`} style={fadeStyle} />
    //         <img src={podiumDark} className={`hidden dark:flex ${className}`} style={fadeStyle} />
    //     </>
    // )

    return (
        <div className={className}>
            <div className='relative w-full'>
            <img src={podiumLight} className='w-full h-auto dark:hidden' style={fadeStyle} />
            <img src={podiumDark} className='hidden w-full h-auto dark:flex' style={fadeStyle} />
            <img
                src={podiumGlow}
                className={`absolute z-20 bottom-[73.2%] w-full h-auto pointer-events-none transition-opacity duration-300 ease-out motion-reduce:transition-none ${glow ? 'opacity-40' : 'opacity-0'}`}
            />
            </div>
        </div>
    )

}

export default Podium
