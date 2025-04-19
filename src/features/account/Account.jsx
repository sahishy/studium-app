import { useOutletContext } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import Header from '../../components/main/Header.jsx'

const Account = () => {

    const { profile } = useOutletContext()
    const { logout } = useAuth()

    return (
        <div className="flex flex-col h-full">

            <Header text={'Account'} profile={profile}/>

        </div>
    )
}

export default Account
