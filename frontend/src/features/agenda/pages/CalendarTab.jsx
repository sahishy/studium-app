import Logo from '../../../shared/components/misc/Logo'

const CalendarTab = () => {

    return (
        <div className='relative w-full h-full min-h-[72vh] flex items-center justify-center'>

            <div className='flex flex-col gap-1 items-center justify-center text-center'>
                <Logo className={'mb-3 w-12 h-12'}/>
                <h1 className='text-3xl font-bold'>Coming soon</h1>
                <p className='text-sm text-neutral1'>This alternate view for tasks will be added in the future.</p>
            </div>

        </div>
    )
}


export default CalendarTab