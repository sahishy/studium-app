import logoSmall from '../../../assets/images/logo_sm.png'
import logoSmallWhite from '../../../assets/images/logo_sm_white.png'

const LoadingState = ({ fullPage = false, className = '' }) => {

    const layoutClass = fullPage
        ? 'relative w-full min-h-screen flex items-center justify-center'
        : 'relative w-full h-full min-h-[120px] flex items-center justify-center'

    return (
        <div role='status' aria-label='Loading' className={`${layoutClass} ${className}`}>

            <img src={logoSmall} alt='' className='absolute w-8 h-8 animate-ping dark:hidden' />
            <img src={logoSmall} alt='' className='bg-w-8 h-8 dark:hidden' />

            <img src={logoSmallWhite} alt='' className='absolute w-8 h-8 animate-ping hidden dark:flex' />
            <img src={logoSmallWhite} alt='' className='w-8 h-8 hidden dark:flex' />

        </div>
    )

}

export default LoadingState
