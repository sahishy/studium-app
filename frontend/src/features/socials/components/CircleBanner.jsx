import { getCircleIcon } from '../utils/circleUtils'

const CircleBanner = ({ banner, className, iconClassName, onClick }) => {

    const BannerIcon = getCircleIcon(banner?.iconIndex)

    return (
        <button
            type='button'
            onClick={onClick}
            disabled={!onClick}
            className={`${className} flex items-center justify-center ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
            style={{ backgroundColor: banner?.bgColor, color: banner?.iconColor }}
        >
            <BannerIcon className={iconClassName} />
        </button>
    )
}

export default CircleBanner