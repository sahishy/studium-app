// The avatar colour tile, shared by the Locker grid and the crate reward so a
// colour always looks the same wherever it is shown.
const ColorSwatch = ({ color, className = '' }) => {
    return (
        <div className={`relative overflow-hidden rounded-[18%] ${className}`}>
            <div className='w-full h-full brightness-95' style={{ backgroundColor: color }} />
            <div
                className='absolute left-[10%] bottom-[10%] w-[80%] h-[80%] rounded-[14%]'
                style={{ backgroundColor: color }}
            />
            <div className='absolute right-[10%] top-[10%] w-[40%] h-[30%] rounded-full bg-white/20' />
        </div>
    )
}

export default ColorSwatch
