import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import pfp from '../../assets/default-profile.jpg'
import { updateUserInfo } from '../../utils/userUtils'

const ProfileTab = () => {

    const { profile } = useOutletContext()
    const [inEditMode, setInEditMode] = useState(false);
    
    const [firstName, setFirstName] = useState(profile.firstName);
    const [lastName, setLastName] = useState(profile.lastName);
    const [email, setEmail] = useState(profile.email);

    const toggleMode = async () => {

        setInEditMode(!inEditMode);

        if(inEditMode) {
            await updateUserInfo(profile.uid, {
                firstName: firstName,
                lastName: lastName
            })
        }

    }

    return (
        <div className='flex flex-col gap-4'>

            <ProfileHeader profile={profile} inEditMode={inEditMode} toggleMode={toggleMode}/>

            <ProfileName profile={profile} inEditMode={inEditMode} firstName={firstName} setFirstName={setFirstName} lastName={lastName} setLastName={setLastName}/>

            <ProfileEmail profile={profile} inEditMode={inEditMode} setLastName={setLastName}/>
                    
        </div>

    )
}

const ProfileContainer = ( { className, children } ) => {
    return (
        <div className={`p-4 border-2 border-border rounded-xl ${className}`}>
            {children}
        </div>
    )
}

const ProfileHeader = ( { profile, inEditMode, toggleMode } ) => {
    return (
        <ProfileContainer className={'flex justify-between items-center gap-4 border-transparent bg-background2'}>
            <div className='flex items-center gap-4'>
                <img
                    src={pfp}
                    alt="profile"
                    className="w-16 h-16 rounded-full object-cover"
                />
                <div>
                    <h1 className='text-2xl'>{profile.firstName} {profile.lastName}</h1>
                </div>                
            </div>

            <button
                onClick={() => toggleMode()}
                className={`px-4 py-2 border-2 border-b-4 rounded-xl active:mt-[2px] active:border-b-2 cursor-pointer transition-all duration-200
                    ${inEditMode ? 'text-white bg-gray-800 border-black hover:bg-black' : 'bg-background0 border-border hover:bg-background5'}`}
            >
                {inEditMode ? 'Save Changes' : 'Edit Profile'}
            </button>
        </ProfileContainer>
    )
}

const ProfileName = ( { profile, inEditMode, firstName, setFirstName, lastName, setLastName } ) => {

    return (
        <ProfileContainer className={'flex gap-4'}>
            
            <div className='flex-1 flex flex-col gap-2'>
                <label className='text-sm text-text2'>
                    First Name
                </label>

                {inEditMode ? (
                    <input
                        className='p-2 text-text1 border-2 border-border rounded-xl'
                        onChange={(e) => setFirstName(e.target.value)}
                        value={firstName}
                    />
                ) : (
                    <h1 className='p-2 text-text2 bg-background2 border-2 border-border rounded-xl'>
                        {profile.firstName}
                    </h1>
                )}
            </div>

            <div className='flex-1 flex flex-col gap-2'>
                <label className='text-sm text-text2'>
                    Last Name
                </label>

                {inEditMode ? (
                    <input
                        className='p-2 text-text1 border-2 border-border rounded-xl'
                        onChange={(e) => setLastName(e.target.value)}
                        value={lastName}
                    />
                ) : (
                    <h1 className='p-2 text-text2 bg-background2 border-2 border-border rounded-xl'>
                        {profile.lastName}
                    </h1>
                )}
            </div>

        </ProfileContainer>
    )
}

const ProfileEmail = ( { profile, inEditMode, setEmail } ) => {
    return (
        <ProfileContainer>
            <div className='flex-1 flex flex-col gap-2'>
                <label className='text-sm text-text2'>
                    Email
                </label>

                {/* isInEditMode ? ( */}
                {false ? (
                    <input
                        className='p-2 text-text1 border-2 border-border rounded-xl'
                        value={profile.email}
                    />
                ) : (
                    <h1 className='p-2 text-text2 bg-background2 border-2 border-border rounded-xl'>
                        {profile.email}
                    </h1>
                )}
            </div>
        </ProfileContainer>
    )
}


export default ProfileTab
