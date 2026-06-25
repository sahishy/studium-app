import logo_sm from '../../../assets/images/logo_sm.png'
import logo_sm_white from '../../../assets/images/logo_sm_white.png'
import logo_lg from '../../../assets/images/logo_lg.png'
import logo_lg_white from '../../../assets/images/logo_lg_white.png'

const imageClass = 'w-full h-full object-contain';

const Logo = ({ className, large = false }) => {

    return (
        <div className={`${className} relative ${large ? 'w-36 h-12' : 'w-8 h-8'}`}>

            {large ? (
                <>
                    <img src={logo_lg} className={`${imageClass} dark:hidden`}/>
                    <img src={logo_lg_white} className={`${imageClass} hidden dark:flex`} />                
                </>
            ) : (
                <>
                    <img src={logo_sm} className={`${imageClass} dark:hidden`} />
                    <img src={logo_sm_white} className={`${imageClass} hidden dark:flex`} />                
                </>
            )}

        </div>
    )


}

export default Logo