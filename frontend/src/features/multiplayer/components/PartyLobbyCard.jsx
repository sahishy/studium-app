import { useState } from 'react'
import { FaCheck, FaCopy } from 'react-icons/fa6'
import Button from '../../../shared/components/ui/Button'
import Card from '../../../shared/components/ui/Card'

const PartyLobbyCard = ({ party, onLeave, className = '' }) => {
    const [copied, setCopied] = useState(false)

    const copyCode = async () => {
        await navigator.clipboard.writeText(party.id)
        setCopied(true)
        setTimeout(() => setCopied(false), 1600)
    }

    return (
        <Card className={`p-3! gap-2! ${className}`}>
            <div className='flex items-center justify-between gap-3'>
                <div className='min-w-0'>
                    <p className='text-xs text-neutral1'>Party code</p>
                    <button onClick={copyCode} className='flex items-center gap-2 group'>
                        <span className='font-semibold tracking-[0.18em]'>{party.id}</span>
                        {copied ? <FaCheck className='text-sat0 text-xs' /> : <FaCopy className='text-neutral1 text-xs group-hover:text-neutral0 transition' />}
                    </button>
                </div>
                <Button type='negative' onClick={onLeave}>LEAVE</Button>
            </div>

        </Card>
    )
}

export default PartyLobbyCard
