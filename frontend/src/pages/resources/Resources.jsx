import { useOutletContext } from 'react-router-dom'
import Topbar from '../../components/main/Topbar'
import Button from '../../components/main/Button'

const Resources = () => {

    const { profile } = useOutletContext()

    return (
        <div className='flex flex-col h-full overflow-scroll'>
            <Topbar profile={profile} />

            <div className='w-full flex-1 flex flex-col gap-4 px-24 pb-24 pt-2'>
                <h1 className='text-2xl font-semibold'>Resources</h1>

            </div>
        </div>
    )

}

export default Resources