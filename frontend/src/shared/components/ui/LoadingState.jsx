import logoSmall from '../../../assets/images/logo_sm.png'

const LoadingState = ({ fullPage = false, className = '' }) => {

    const layoutClass = fullPage
        ? 'w-full min-h-screen flex items-center justify-center'
        : 'w-full h-full min-h-[120px] flex items-center justify-center'

    return (
        <div className={`${layoutClass} ${className}`}>
            <img src={logoSmall} className='absolute w-8 h-8 animate-ping' />
            <img src={logoSmall} className='w-8 h-8' />
        </div>
    )

}

export default LoadingState
