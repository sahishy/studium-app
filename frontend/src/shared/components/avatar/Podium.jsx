import podiumLight from '../../../assets/images/podium.png'
import podiumDark from '../../../assets/images/podium_dark.png'

const Podium = ( { className } ) => {

    return (
        <>
            <img src={podiumLight} className={`dark:hidden ${className}`} />
            <img src={podiumDark} className={`hidden dark:flex ${className}`} />        
        </>
    )

}

export default Podium