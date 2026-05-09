import logo from '../../../assets/images/logo_sm.png'

const CalendarTab = () => {

    return (
        <div className='relative w-full h-full min-h-[72vh] flex items-center justify-center'>

            <div className='flex flex-col gap-1 items-center justify-center text-center'>
                <img src={logo} className='object-contain w-12 mb-3' />
                <h1 className='text-3xl font-bold'>Coming soon</h1>
                <p className='text-sm text-neutral1'>This alternate view for tasks will be added soon.</p>
            </div>

        </div>
    )
}


export default CalendarTab