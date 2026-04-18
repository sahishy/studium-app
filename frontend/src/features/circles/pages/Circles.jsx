import { Link, useOutletContext } from 'react-router-dom'
import Topbar from '../../../shared/components/ui/Topbar.jsx'
import CircleCard from '../components/CircleCard.jsx'
import CreateCircleModal from '../components/modals/CreateCircleModal'
import { useModal } from '../../../shared/contexts/ModalContext'
import JoinCircleModal from '../components/modals/JoinCircleModal'
import { useCircles } from '../contexts/CirclesContext'
import Button from '../../../shared/components/ui/Button'
import BottomFade from '../../../shared/components/ui/BottomFade'
import { FaArrowUp } from 'react-icons/fa6'

const Circles = () => {

    const { profile } = useOutletContext()
    const circles = useCircles()

    return (
        <div className='flex flex-col h-full overflow-scroll'>
            <Topbar profile={profile} />

            <div className='w-full h-full flex flex-col gap-4 lg:flex-row lg:gap-16 lg:items-start px-24 pb-8 pt-2 m-auto'>
                <div className='flex-2 flex flex-col gap-4 pb-16'>

                    <div className='flex justify-between items-start'>

                        <div className='flex flex-col gap-1'>
                            <h1 className='text-2xl font-semibold'>Circles</h1>
                            <h2 className='text-sm text-neutral1'>Join study circles with friends to share tasks.</h2>
                        </div>

                        <div className='flex gap-2'>
                            <CreateCircleButton profile={profile} />
                            <JoinCircleButton profile={profile} />
                        </div>

                    </div>


                    <div className='w-full flex flex-col gap-4'>

                        {/* <h1 className='text-lg text-text1 font-semibold'>Your Circles</h1> */}

                        {circles.length === 0 ? (
                            <div className='w-full flex flex-col items-center justify-center py-48 gap-3'>
                                <FaArrowUp className='text-neutral1 rotate-45' />
                                <p className='text-sm text-neutral1'>You haven't joined any study circles yet.</p>
                            </div>
                        ) : (
                            <div className='w-full grid grid-cols-2 auto-rows-auto gap-4'>
                                {circles.sort((a, b) => a.title.localeCompare(b.title)).map((circle) => (

                                    <Link
                                        key={circle.uid}
                                        to={circle.uid}
                                    >
                                        <CircleCard circle={circle} />
                                    </Link>

                                ))}
                            </div>
                        )}

                    </div>




                </div>
            </div>
            <BottomFade />
        </div>
    )
}

const CreateCircleButton = ({ profile }) => {

    const { openModal, closeModal } = useModal()

    const handleClick = () => {
        openModal(<CreateCircleModal profile={profile} closeModal={closeModal} />)
    }

    return (
        <Button onClick={handleClick} type={'secondary'}>
            Create Circle
        </Button>
    )
}

const JoinCircleButton = ({ profile }) => {

    const { openModal, closeModal } = useModal()

    const handleClick = () => {
        openModal(<JoinCircleModal profile={profile} closeModal={closeModal} />)
    }

    return (
        <Button onClick={handleClick} type={'secondary'}>
            Join Circle
        </Button>
    )
}


export default Circles