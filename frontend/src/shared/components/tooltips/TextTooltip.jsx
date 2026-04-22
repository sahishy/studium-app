import BaseTooltip from "./BaseTooltip";

const TextTooltip = ({ children, text, placement = 'auto', className = '', disabled = false }) => {

    const Tooltip = () => (
        <p className="py-1 px-2 bg-neutral0 text-neutral6 text-xs rounded-lg">
            {text}
        </p>
    )

    return (
        <BaseTooltip
            content={<Tooltip/>}
            placement={placement}
            className={className}
            disabled={disabled}
        >
            {children}
        </BaseTooltip>
    )

}

export default TextTooltip;