import { useState } from 'react';
import BasePopover from './BasePopover';
import { PiCaretDownFill, PiCaretUpFill } from 'react-icons/pi';

const TimePicker = ({ children, onSelect, selectedTime, className = '' }) => {

    const [time, setTime] = useState(selectedTime);

    const onOpen = () => {
        setTime(selectedTime);
    }

    const handleSelectTime = (amount) => {
        onSelect(Math.max(amount, 0));
    }

    const timePickerContent = (closePopover) => (
        <div className="rounded-xl w-full flex flex-col gap-2 text-sm">

            <div className="flex justify-center items-center gap-8">

            <div className='flex flex-col items-center gap-2'>
                    <button
                        onClick={() => setTime(time + 60)}
                        className="p-2 border-2 border-border border-b-4 rounded-xl hover:bg-background5 active:mt-[2px] active:border-b-2 cursor-pointer transition-all duration-200"
                    >
                        <PiCaretUpFill/>
                    </button>

                    <div className='text-center'>
                        <h1 className="font-extrabold text-lg">
                            {Math.floor(time / 60)}
                        </h1>
                        <p className="font-semibold text-text2">
                            hours
                        </p>                        
                    </div>

                    <button
                        onClick={() => time >= 60 && setTime(time - 60) }
                        className={`p-2 border-2 border-border border-b-4 rounded-xl transition-all duration-200 ${time < 60 ? 'opacity-50' : ' active:mt-[2px] active:border-b-2 hover:bg-background5 cursor-pointer'}`}
                    >
                        <PiCaretDownFill/>
                    </button>
                </div>

                <div className='flex flex-col items-center gap-2'>
                    <button
                        onClick={() => setTime(time + 5)}
                        className="p-2 border-2 border-border border-b-4 rounded-xl hover:bg-background5 active:mt-[2px] active:border-b-2 cursor-pointer transition-all duration-200"
                    >
                        <PiCaretUpFill/>
                    </button>

                    <div className='text-center'>
                        <h1 className="font-extrabold text-lg">
                            {time % 60}
                        </h1>
                        <p className="font-semibold text-text2">
                            mins
                        </p>                        
                    </div>

                    <button
                        onClick={() => setTime(Math.max(time - 5, 0))}
                        className={`p-2 border-2 border-border border-b-4 rounded-xl transition-all duration-200 ${time === 0 ? 'opacity-50' : ' active:mt-[2px] active:border-b-2 hover:bg-background5 cursor-pointer'}`}
                    >
                        <PiCaretDownFill/>
                    </button>
                </div>

            </div>

            <div className='flex gap-2 m-2'>
                <button
                    onClick={() => {
                        handleSelectTime(0);
                        closePopover();
                    }}
                    className='w-full p-2 border-2 border-border border-b-4 rounded-xl hover:bg-background5 active:mt-[2px] active:border-b-2 cursor-pointer transition-all duration-200'
                >
                    Clear
                </button>
                <button
                    onClick={() => {
                        handleSelectTime(time)
                        closePopover();
                    }}
                    className='w-full p-2 text-white border-black border-b-4 rounded-xl bg-gray-800 hover:bg-black active:mt-[2px] active:border-b-2 cursor-pointer transition-all duration-200'
                >
                    Save
                </button>             
            </div>
  

        </div>
  );

    return (
        <BasePopover content={timePickerContent} className={className} onOpen={onOpen}>
            {(isOpen) => children(isOpen)}
        </BasePopover>
    );
};

export default TimePicker;