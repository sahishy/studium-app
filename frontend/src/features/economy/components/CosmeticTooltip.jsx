import BaseTooltip from '../../../shared/components/tooltips/BaseTooltip'
import Card from '../../../shared/components/ui/Card'
import { getRarityStyle } from '../utils/rarityUtils'

// Shared by every cosmetic slot, so faces and hats get the same treatment as
// colors once they are unlockable.
const CosmeticTooltip = ({ children, name, rarity = 'Common', locked = false, placement = 'top', disabled = false, className = '' }) => {

    const style = getRarityStyle(rarity)

    const Tooltip = () => (
        <Card className='items-center p-2.5! gap-0.5! mb-1'>
            <p className={`text-xs font-semibold ${locked ? 'text-neutral2' : 'text-neutral0'}`}>
                {locked ? '???' : name}
            </p>
            <span className='flex items-center gap-1.5 text-[0.65rem] font-semibold'>
                <span className={`size-1.5 rounded-full ${style.bar}`} />
                <span className={style.text}>{rarity}</span>
            </span>
        </Card>
    )

    return (
        <BaseTooltip
            content={<Tooltip />}
            placement={placement}
            disabled={disabled}
            className={className}
        >
            {children}
        </BaseTooltip>
    )
}

export default CosmeticTooltip
