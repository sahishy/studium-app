import BaseTooltip from '../../../../shared/components/tooltips/BaseTooltip'
import Card from '../../../../shared/components/ui/Card'
import LumenIcon from '../LumenIcon'

const LumenTooltip = ({ children, balance = 0, placement = 'auto', className = '', disabled = false }) => {

    const formattedBalance = new Intl.NumberFormat('en-US', {
        notation: 'compact',
        maximumFractionDigits: 1
    }).format(balance);

    const Tooltip = () => (
        <Card className='items-center p-6'>
            <div className='flex items-center gap-6'>
                <LumenIcon className='size-14' />
                <div className='flex flex-col items-start'>
                    <h2 className='font-bold text-5xl'>{formattedBalance}</h2>
                    <p className='font-semibold text-neutral1 text-sm'>lumen</p>
                </div>
            </div>
        </Card>
    )

    return (
        <BaseTooltip
            content={<Tooltip />}
            placement={placement}
            className={className}
            disabled={disabled}
        >
            {children}
        </BaseTooltip>
    )

}

export default LumenTooltip
