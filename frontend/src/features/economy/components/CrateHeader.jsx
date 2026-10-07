import { FaBoxOpen } from 'react-icons/fa6'
import Button from '../../../shared/components/ui/Button'
import LumenIcon from './LumenIcon'

// Sits above the drops card, not inside it.
const CrateHeader = ({ crate }) => {

    const { canOpen, assetReady, isBusy, hasToken, cratePrice, open, error } = crate

    return (
        <div className='flex flex-col gap-3'>

            <Button
                type='primary'
                onClick={open}
                disabled={!canOpen || !assetReady || isBusy}
                className='p-4! text-xl! font-bold! w-full'
            >
                {!assetReady
                    ? 'LOADING'
                    : hasToken
                        ? <span className='flex items-center gap-2'>1 <FaBoxOpen /></span>
                        : <span className='flex items-center gap-2'>{cratePrice} <LumenIcon className='size-5' /></span>}
            </Button>

            {error ? <p role='alert' className='text-xs text-red-400 text-center'>{error}</p> : null}

        </div>
    )
}

export default CrateHeader
