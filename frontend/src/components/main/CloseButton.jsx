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
            className={`!p-2 ${className}`}
        >
            <IoClose className={'text-xl'}/>
        </Button>
    )
}

export default CloseButton
