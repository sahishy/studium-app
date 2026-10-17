import useMobileView from '../../../shared/utils/useMobileView'
import FittedAvatarStage from '../../../shared/components/avatar/FittedAvatarStage'

const OpponentPreview = ({ children }) => {
    const mobile = useMobileView()
    if(!mobile) return children
    return (
        <div data-opponent-preview className='opponent-arena' aria-label='Opponent arena'>
            <FittedAvatarStage minWidth={24} minHeight={30} className='h-full w-full'>
                <div className='h-full w-full flex'>{children}</div>
            </FittedAvatarStage>
        </div>
    )
}
export default OpponentPreview
