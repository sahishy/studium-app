import BaseTooltip from "./BaseTooltip";

const Tooltip = ({ children, text, placement = 'auto', className = '' }) => {
    return (
        <BaseTooltip
            content={text}
            placement={placement}
            className={className}
        >
            {children}
        </BaseTooltip>
    )
}

export default Tooltip;