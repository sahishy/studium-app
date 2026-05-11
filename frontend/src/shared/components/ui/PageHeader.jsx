const PageHeader = ({ text, icon }) => {

    const Icon = icon;

    return (
        <div className='flex gap-3'>
            <div className='bg-neutral5 p-2 rounded-xl text-sm text-neutral1'><Icon/></div>
            <h1 className='text-2xl font-semibold'>{text}</h1>
        </div>
    )

}

export default PageHeader