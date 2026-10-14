import { getCircleIcon } from '../utils/circleUtils'

const CircleBanner = ({ banner, className, iconClassName, onClick }) => {

    const BannerIcon = getCircleIcon(banner?.iconIndex)
    const BannerElement = onClick ? 'button' : 'div'
    const interactiveProps = onClick ? { type: 'button', onClick } : {}

    return (
        <BannerElement
            {...interactiveProps}
            className={`${className} flex items-center justify-center ${onClick ? 'cursor-pointer' : ''}`}
            style={{ backgroundColor: banner?.bgColor, color: banner?.iconColor }}
        >
            <BannerIcon className={iconClassName} />
        </BannerElement>
    )
}

export default CircleBanner
