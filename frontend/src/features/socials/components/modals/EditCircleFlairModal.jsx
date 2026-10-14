import { useState } from 'react'
import Button from '../../../../shared/components/ui/Button'
import { FaCircleExclamation } from 'react-icons/fa6'
import { hasFlaggedWords } from '../../../../shared/services/censorService'
import { updateCircle } from '../../services/circleService'

export default function EditCircleFlairModal({ circle, closeModal }) {
    const [flair, setFlair] = useState(circle.profile.flair || '')
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)
    const trimmedFlair = flair.trim()
    const validationError = trimmedFlair.length > 5 ? 'Flair must be 5 characters or fewer.'
        : hasFlaggedWords(trimmedFlair) ? 'Inappropriate flair.' : ''

    const save = async (event) => {
        event.preventDefault()
        if (busy || validationError) return
        setBusy(true)
        try { await updateCircle(circle.uid, { 'profile.flair': trimmedFlair }); closeModal() }
        catch (err) { setError(err.message) }
        finally { setBusy(false) }
    }

    return <div className="flex flex-col gap-8">
        <h1 className="text-2xl font-semibold text-center">Edit Circle Flair</h1>
        <form onSubmit={save} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
                <label htmlFor="circle-flair" className="text-sm text-neutral1">Flair (optional)</label>
                <input id="circle-flair" value={flair} maxLength={5} onChange={e => { setFlair(e.target.value); setError('') }}
                    placeholder="Flair" aria-describedby="circle-flair-hint"
                    className="w-full p-4 border-2 border-neutral4 rounded-xl focus:outline-gray-400" />
                <p id="circle-flair-hint" className="text-xs text-neutral1">Up to 5 characters. Leave blank to remove your flair.</p>
            </div>
            <p className="text-sm text-neutral1">Members can display this flair through their primary Circle.</p>
            {(validationError || error) && <p role="alert" className="text-sm text-red-400 flex items-center gap-2"><FaCircleExclamation />{validationError || error}</p>}
            <div className="flex gap-4 mt-4">
                <Button onClick={closeModal} type="secondary" className="w-full py-4" disabled={busy}>Cancel</Button>
                <Button htmlType="submit" type="primary" className="w-full py-4" disabled={Boolean(validationError) || busy} loading={busy}>Save Changes</Button>
            </div>
        </form>
    </div>
}
