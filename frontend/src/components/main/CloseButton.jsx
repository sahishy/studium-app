import { IoClose } from 'react-icons/io5'
import Button from './Button'

const CloseButton = ({
    onClick,
    className = '',
}) => {
    return (
        <Button
            onClick={onClick}
            type={'tertiary'}
            aria-label={'Close'}
            className={`!p-2 text-xl ${className}`}
        >
            <IoClose/>
        </Button>
    )
}

export default CloseButton
