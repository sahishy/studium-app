import { useOutletContext } from 'react-router-dom'

const ProfileTab = () => {

    const { profile } = useOutletContext()

    return (
        <div className='flex flex-col gap-4'>

            Hi
                    
        </div>

    )
}


export default ProfileTab
