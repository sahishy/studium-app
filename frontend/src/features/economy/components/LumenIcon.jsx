import lumen from '../../../assets/images/lumen.svg'

const LumenIcon = ({ className = 'size-5' }) => {
    return (
        <img
            src={lumen}
            alt=''
            aria-hidden='true'
            draggable={false}
            className={`select-none ${className}`}
        />
    )
}

export default LumenIcon
