import { useOutletContext } from 'react-router-dom'
import Topbar from '../../../shared/components/ui/Topbar'
import Button from '../../../shared/components/ui/Button'

const Resources = () => {

    const { profile } = useOutletContext()

    return (
        <div className='flex flex-col h-full overflow-scroll'>
            <Topbar profile={profile} />

            <div className='w-full flex-1 flex flex-col gap-4 px-24 pb-24 pt-2'>
                <h1 className='text-2xl font-semibold'>Resources</h1>

                <div className='flex-1 flex flex-col gap-3 items-center justify-center'>
                    <h1 className='text-4xl font-semibold'>Coming Soon</h1>
                    <p className='text-sm text-neutral1'>A hub for students to post and recommend their favorite resources for studying.</p>
                </div>

            </div>
        </div>
    )

}

export default Resources