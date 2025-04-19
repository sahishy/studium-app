import { useRef, useState } from 'react';
import { joinCircle, canJoinCircle } from '../../utils/circleUtils';

const JoinCircleModal = ( { profile, closeModal } ) => {

    const [codeArray, setCodeArray] = useState(new Array(6).fill(''));
    const inputsRef = useRef([]);
  
    const handleChange = (e, index) => {

        const value = e.target.value;

        if(!/^[0-9a-zA-Z]?$/.test(value)) {
            return
        }
  
        const newCode = [...codeArray];
        newCode[index] = value;
        setCodeArray(newCode);
  
        if(value && index < 5) {
            inputsRef.current[index + 1].focus();
        }

    };
  
    const handleKeyDown = (e, index) => {
        if(e.key === 'Backspace' && !codeArray[index] && index > 0) {
            inputsRef.current[index - 1].focus();
        }
    }
  
    const handlePaste = (e) => {

        e.preventDefault();

        const pasted = e.clipboardData.getData('text').slice(0, 6);
        const newCode = [...codeArray];

        for(let i = 0; i < pasted.length; i++) {
            newCode[i] = pasted[i];
            if(inputsRef.current[i]) {
                inputsRef.current[i].value = pasted[i];
            }
        }

        setCodeArray(newCode)

        if(pasted.length < 6 && inputsRef.current[pasted.length]) {
            inputsRef.current[pasted.length].focus();
        }

    }
  
    const handleJoin = async (e) => {

        e.preventDefault();
    
        const inviteCode = codeArray.map(x => x.toUpperCase()).join('');
        const { circleId, canJoin } = await canJoinCircle(profile.uid, inviteCode);
    
        if(canJoin) {
            joinCircle(profile.uid, circleId);
            closeModal();
        } else {
            console.log('invalid code or user already in circle');
        }

    }

    return (
        <div className='flex flex-col gap-8'>

            <h1 className='text-2xl font-semibold text-center'>
                Join Circle
            </h1>

            <form onSubmit={handleJoin} className="flex flex-col gap-4">

                <div
                    className="flex justify-center gap-2"
                    onPaste={handlePaste}
                >
                    {codeArray.map((char, index) => (
                        <input
                            key={index}
                            type="text"
                            maxLength={1}
                            value={char}
                            onChange={(e) => handleChange(e, index)}
                            onKeyDown={(e) => handleKeyDown(e, index)}
                            ref={(el) => (inputsRef.current[index] = el)}
                            className="w-16 h-16 uppercase text-center text-2xl border-2 border-gray-200 rounded-lg focus:outline-none focus:border-yellow-400"
                            required
                        />
                    ))}
                </div>

                <div className='flex gap-4 mt-4'>
                    <button
                        type='button' 
                        onClick={() => closeModal()}
                        className='w-full p-4 border-2 border-gray-200 border-b-4 rounded-lg hover:bg-gray-800/5 active:mt-[2px] active:border-b-2 cursor-pointer transition-all duration-200'
                    >
                        Cancel
                    </button>

                    <button 
                        type='submit' 
                        className='w-full p-4 text-white border-black border-b-4 rounded-lg bg-gray-800 hover:bg-black active:mt-[2px] active:border-b-2 cursor-pointer transition-all duration-200'
                    >
                        Join
                    </button>
                </div>

            </form>

        </div>

    )
}

export default JoinCircleModal