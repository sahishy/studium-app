import Logo from '../misc/Logo'

const ComingSoon = ({ description }) => (
    <div className='flex-1 mb-12 flex flex-col justify-center items-center text-center'>
        <Logo className='mb-3' />
        <h1 className='text-3xl font-bold'>Coming soon</h1>
        <p className='mt-2 text-sm text-neutral1'>{description}</p>
    </div>
)

export default ComingSoon
