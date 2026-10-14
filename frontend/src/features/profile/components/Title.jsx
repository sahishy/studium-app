import { TITLE_RARITY_SHINE, describeTitle } from '../utils/titleUtils'

// A student's equipped title, shown under their display name on their profile and on the match
// intro banner. Common renders flat; everything above it carries a rarity-coloured sheen, which is
// what makes a rare title worth equipping at all.
const Title = ({ titleId, className = '', size = 'sm' }) => {

    const title = describeTitle(titleId)

    if(!title) return null

    const textSize = size === 'xs' ? 'text-[0.65rem]' : (size === 'md' ? 'text-sm' : 'text-xs')

    if(title.rarity === 'Common') {
        return (
            <span className={`${textSize} font-semibold text-neutral1 ${className}`}>
                {title.name}
            </span>
        )
    }

    const shine = TITLE_RARITY_SHINE[title.rarity]

    return (
        <span
            // bg-clip-text with transparent glyphs is what lets the travelling gradient show
            // through the letters; without the explicit background-size the keyframe has nothing
            // to slide across and the text renders as a flat block of colour.
            className={`${textSize} font-semibold bg-clip-text text-transparent bg-[length:200%_auto]
                animate-title-shine ${shine} ${className}`}
        >
            {title.name}
        </span>
    )
}

export default Title
