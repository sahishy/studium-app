import { useOutletContext } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import Header from '../../components/main/Header.jsx'

const Account = () => {

    const { profile } = useOutletContext()
    const { logout } = useAuth()

    return (
        <div className='flex flex-col h-full overflow-scroll'>

            <Header text={'Account'} profile={profile}/>

            <div className='w-full h-full flex flex-col gap-4 px-24 pb-8 pt-2 m-auto'>

                <h1 className='text-gray-400'>Coming soon!</h1>

            </div>

        </div>
    )
}

export default Account
