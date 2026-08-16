import { useOutletContext } from 'react-router-dom'
import { FaTrophy } from 'react-icons/fa6'
import Topbar from '../../../shared/components/ui/Topbar'
import PageHeader from '../../../shared/components/ui/PageHeader'
import Logo from '../../../shared/components/misc/Logo'

const Leaderboards = () => {
    const { profile } = useOutletContext()

    return (
        <div className='flex flex-col h-full overflow-scroll'>
            <Topbar profile={profile} />

            <div className='w-full flex-1 flex flex-col gap-4 px-24 pb-24 pt-2'>
                <PageHeader text='Leaderboards' icon={FaTrophy} />

                <div className='flex-1 flex flex-col gap-1 items-center justify-center'>
                    <Logo className='mb-3 w-12 h-12' />
                    <h1 className='text-3xl font-bold'>Coming soon</h1>
                    <p className='text-sm text-neutral1'>See how you rank against other SAT competitors.</p>
                </div>
            </div>
        </div>
    )
}

export default Leaderboards
