import { Link, useOutletContext } from 'react-router-dom'
import Header from '../../components/main/Header.jsx'
import Circle from '../../components/circles/Circle.jsx'
import CircleFriends from '../../components/circles/CirclesFriends.jsx'
import CreateCircleModal from '../../components/modals/CreateCircleModal.jsx'
import { useModal } from '../../contexts/ModalContext.jsx'
import JoinCircleModal from '../../components/modals/JoinCircleModal.jsx'
import { useCircles } from '../../contexts/CirclesContext.jsx'

const Circles = () => {

    const { profile } = useOutletContext()
    const circles = useCircles()

    return (
        <div className="flex flex-col h-full relative">
            <Header text={'Circles'} profile={profile}/>
            <div className="flex-1 overflow-y-auto relative">

                <div className='w-full h-full flex flex-col gap-4 lg:flex-row lg:gap-8 lg:items-start px-8 pb-8 pt-2 max-w-5xl m-auto'>

                    <div className='flex-2 flex flex-col gap-8 pb-16'>



                        <div className='w-full flex flex-col gap-4'>

                            {/* <h1 className='text-lg text-gray-600 font-extrabold'>Your Circles</h1> */}

                            <div className='flex gap-2'>

                                <CreateCircleButton profile={profile}/>
                                <JoinCircleButton profile={profile}/>

                            </div>

                            <div className='w-full grid grid-cols-2 auto-rows-auto gap-4'>

                                {circles.length === 0 ? (
                                    <p className='text-sm text-gray-400'>You aren't in any study circles.</p>
                                ) : (
                                    <>
                                        {circles.sort((a, b) => a.title.localeCompare(b.title)).map((circle) => (

                                            <Link
                                                key={circle.uid}
                                                to={circle.uid}
                                            >
                                                <Circle circle={circle}/>
                                            </Link>

                                        ))}
                                    </>
                                )}

                            </div>

                        </div>

                    </div>
                    

                    <div className='flex-1 min-w-0'>
                        
                        <CircleFriends userId={profile.uid}/>
                        
                    </div>

                </div>


            </div>
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white to-transparent"/>
        </div>
    )
}

const CreateCircleButton = ( { profile } ) => {

    const { openModal, closeModal } = useModal()

    const handleClick = () => {
        openModal(<CreateCircleModal profile={profile} closeModal={closeModal}/>)
    }

    return (
        <button
            onClick={handleClick}
            className='px-4 py-2 border-2 border-gray-200 border-b-4 rounded-lg hover:bg-gray-800/5 active:mt-[2px] active:border-b-2 cursor-pointer transition-all duration-200'
        >
            Create Circle
        </button>
    )
}

const JoinCircleButton = ( { profile } ) => {

    const { openModal, closeModal } = useModal()

    const handleClick = () => {
        openModal(<JoinCircleModal profile={profile} closeModal={closeModal}/>)
    }

    return (
        <button
            onClick={handleClick}
            className='px-4 py-2 border-2 border-gray-200 border-b-4 rounded-lg hover:bg-gray-800/5 active:mt-[2px] active:border-b-2 cursor-pointer transition-all duration-200'
        >
            Join Circle
        </button>
    )
}


export default Circles