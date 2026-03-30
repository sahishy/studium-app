import { Link, useOutletContext } from 'react-router-dom'
import Topbar from '../../components/main/Topbar.jsx'
import CircleCard from '../../components/circles/CircleCard.jsx'
import CreateCircleModal from '../../components/modals/CreateCircleModal.jsx'
import { useModal } from '../../contexts/ModalContext.jsx'
import JoinCircleModal from '../../components/modals/JoinCircleModal.jsx'
import { useCircles } from '../../contexts/CirclesContext.jsx'
import Button from '../../components/main/Button.jsx'
import BottomFade from '../../components/main/BottomFade.jsx'

const Circles = () => {

    const { profile } = useOutletContext()
    const circles = useCircles()

    return (
        <div className='flex flex-col h-full overflow-scroll'>
            <Topbar profile={profile} />

            <div className='w-full h-full flex flex-col gap-4 lg:flex-row lg:gap-16 lg:items-start px-24 pb-8 pt-2 m-auto'>
                <div className='flex-2 flex flex-col gap-4 pb-16'>

                    <h1 className="text-2xl font-semibold">Circles</h1>

                    <div className='w-full flex flex-col gap-4'>

                        {/* <h1 className='text-lg text-text1 font-semibold'>Your Circles</h1> */}

                        <div className='flex gap-2'>

                            <CreateCircleButton profile={profile}/>
                            <JoinCircleButton profile={profile}/>

                        </div>

                        <div className='w-full grid grid-cols-2 auto-rows-auto gap-4'>

                            {circles.length === 0 ? (
                                <p className='text-sm text-text2'>You aren't in any study circles.</p>
                            ) : (
                                <>
                                    {circles.sort((a, b) => a.title.localeCompare(b.title)).map((circle) => (

                                        <Link
                                            key={circle.uid}
                                            to={circle.uid}
                                        >
                                            <CircleCard circle={circle}/>
                                        </Link>

                                    ))}
                                </>
                            )}

                        </div>

                    </div>


                    

                </div>

            </div>
            <BottomFade/>
        </div>
    )
}

const CreateCircleButton = ( { profile } ) => {

    const { openModal, closeModal } = useModal()

    const handleClick = () => {
        openModal(<CreateCircleModal profile={profile} closeModal={closeModal}/>)
    }

    return (
        <Button onClick={handleClick} type={'secondary'}>
            Create Circle
        </Button>
    )
}

const JoinCircleButton = ( { profile } ) => {

    const { openModal, closeModal } = useModal()

    const handleClick = () => {
        openModal(<JoinCircleModal profile={profile} closeModal={closeModal}/>)
    }

    return (
        <Button onClick={handleClick} type={'secondary'}>
            Join Circle
        </Button>
    )
}


export default Circles