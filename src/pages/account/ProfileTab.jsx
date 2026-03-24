import { useOutletContext } from 'react-router-dom'
import pfp from '../../assets/default-profile.jpg'

const ProfileTab = () => {

    const { profile } = useOutletContext()

    return (
        <div className='flex flex-col gap-4'>

            Hi
                    
        </div>

    )
}


export default ProfileTab
