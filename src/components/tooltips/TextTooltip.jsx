import BaseTooltip from "./BaseTooltip";

const TextTooltip = ({ children, text, placement = 'auto', className = '', disabled = false }) => {
    return (
        <BaseTooltip
            content={text}
            placement={placement}
            className={className}
            disabled={disabled}
        >
            {children}
        </BaseTooltip>
    )
}

export default TextTooltip;