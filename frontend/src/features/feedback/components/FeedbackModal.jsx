import { useEffect, useId, useRef, useState } from 'react'
import { FaCamera, FaCheck, FaImage, FaXmark } from 'react-icons/fa6'
import Button from '../../../shared/components/ui/Button.jsx'
import { IMAGE_TYPES, submitFeedback, validateFeedbackImage } from '../services/feedbackService.js'
import { useModalVisibility } from '../../../shared/contexts/ModalVisibilityContext.jsx'
import ScreenshotCaptureWindow from './ScreenshotCaptureWindow.jsx'

const FeedbackModal = ({ closeModal }) => {
    const [description, setDescription] = useState('')
    const [category, setCategory] = useState('')
    const [image, setImage] = useState(null)
    const [preview, setPreview] = useState('')
    const [error, setError] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [screenshotOpen, setScreenshotOpen] = useState(false)
    const setModalHidden = useModalVisibility()
    const submittingRef = useRef(false)
    const fileInputRef = useRef(null)
    const descriptionId = useId()
    const categoryName = useId()

    const openScreenshot = () => {
        setError('')
        setScreenshotOpen(true)
        setModalHidden(true)
    }

    const closeScreenshot = () => {
        setScreenshotOpen(false)
        setModalHidden(false)
    }

    const attachScreenshot = (file) => {
        const imageError = validateFeedbackImage(file)
        setError(imageError)
        if (!imageError) setImage(file)
        closeScreenshot()
    }

    useEffect(() => {
        if (!image) { setPreview(''); return }
        const url = URL.createObjectURL(image)
        setPreview(url)
        return () => URL.revokeObjectURL(url)
    }, [image])

    const selectImage = (event) => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (!file) return
        const imageError = validateFeedbackImage(file)
        setError(imageError)
        if (!imageError) setImage(file)
    }

    const handleSubmit = async (event) => {
        event.preventDefault()
        if (!category || !description.trim() || submittingRef.current) return
        submittingRef.current = true
        setSubmitting(true)
        setError('')
        try {
            await submitFeedback(description, image, category)
            setSubmitted(true)
            setImage(null)
        } catch (submitError) {
            setError(submitError.message || 'Could not send your feedback. Please try again.')
        } finally {
            submittingRef.current = false
            setSubmitting(false)
        }
    }

    return (
        <>
            {screenshotOpen && <ScreenshotCaptureWindow onCapture={attachScreenshot} onClose={closeScreenshot} />}
            <div className='flex flex-col gap-8'>
                <h1 className='text-2xl font-semibold text-center'>Submit Feedback</h1>
                {submitted ? (
                    <div className='flex flex-col gap-8'>
                        <div role='status' className='flex flex-col items-center gap-3 py-6 text-center'>
                            <div className='size-12 rounded-full bg-neutral4 flex items-center justify-center mb-2'>
                                <FaCheck className='text-xl text-neutral0' />
                            </div>
                            <h2 className='text-lg font-semibold'>Thank you!</h2>
                            <p className='text-sm text-neutral1'>Your feedback helps us make Studium better.</p>
                        </div>
                        <Button onClick={closeModal} type='primary' className='w-full py-4'>Close</Button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className='flex flex-col gap-4'>
                        <fieldset disabled={submitting} className='flex flex-col gap-2'>
                            <legend className='text-sm text-neutral1 mb-2'>Feedback type</legend>
                            <div className='grid grid-cols-2 gap-1 p-1 bg-neutral5 rounded-xl'>
                                {[
                                    { value: 'suggestion', label: 'Suggestion' },
                                    { value: 'bug-report', label: 'Bug report' },
                                ].map((option) => (
                                    <label key={option.value} className={`relative ${submitting ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                                        <input
                                            type='radio'
                                            name={categoryName}
                                            value={option.value}
                                            checked={category === option.value}
                                            onChange={() => setCategory(option.value)}
                                            required
                                            className='peer sr-only'
                                        />
                                        <span className='block px-3 py-2 rounded-lg text-sm text-center text-neutral1 transition-colors hover:text-neutral0 peer-checked:bg-neutral6 peer-checked:text-neutral0 peer-focus-visible:outline-2 peer-focus-visible:outline-neutral0'>
                                            {option.label}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </fieldset>
                        <div className='flex flex-col gap-2'>
                            <label htmlFor={descriptionId} className='text-sm text-neutral1'>Description</label>
                            <textarea
                                id={descriptionId}
                                value={description}
                                onChange={(event) => setDescription(event.target.value)}
                                placeholder='Share an idea, report a bug, or tell us what could be better…'
                                required
                                maxLength={4000}
                                disabled={submitting}
                                className='w-full h-32 min-h-24 max-h-48 resize-y p-4 border-2 border-neutral4 rounded-xl text-sm focus:outline-gray-400 disabled:opacity-60'
                            />
                        </div>
                        <div className='flex flex-col gap-2'>
                            <p className='text-sm text-neutral1'>Image <span className='text-neutral2'>(optional)</span></p>
                            <input ref={fileInputRef} type='file' accept={IMAGE_TYPES.join(',')} onChange={selectImage} disabled={submitting} className='hidden' aria-label='Attach an image' />
                            {image ? (
                                <div className='flex items-center gap-3 p-3 border-2 border-neutral4 rounded-xl'>
                                    {preview && <img src={preview} alt='Feedback attachment preview' className='size-16 rounded-lg object-cover shrink-0' />}
                                    <span className='text-sm text-neutral1 truncate flex-1'>{image.name}</span>
                                    <button type='button' aria-label='Remove image' disabled={submitting} onClick={() => setImage(null)} className='p-2 rounded-full text-neutral1 hover:text-neutral0 hover:bg-neutral4 cursor-pointer disabled:opacity-60'>
                                        <FaXmark />
                                    </button>
                                </div>
                            ) : (
                                <div className='flex items-center gap-4'>
                                    <button type='button' onClick={() => fileInputRef.current?.click()} disabled={submitting} className='flex flex-1 items-center justify-center gap-2 px-3 py-6 border-2 border-dashed border-neutral4 rounded-xl text-sm text-neutral1 hover:border-neutral2 hover:text-neutral0 transition cursor-pointer disabled:opacity-60'>
                                        <FaImage className='shrink-0' /> Attach an image
                                    </button>
                                    <span className='text-xs text-neutral2'>or</span>
                                    <button type='button' onClick={openScreenshot} disabled={submitting} className='flex flex-1 items-center justify-center gap-2 px-3 py-6 border-2 border-dashed border-neutral4 rounded-xl text-sm text-neutral1 hover:border-neutral2 hover:text-neutral0 transition cursor-pointer disabled:opacity-60'>
                                        <FaCamera className='shrink-0' /> Take screenshot
                                    </button>
                                </div>
                            )}
                            <p className='text-xs text-neutral2'>PNG, JPG, WebP, or GIF · up to 5 MB</p>
                        </div>
                        {error && <p role='alert' className='text-sm text-red-400'>{error}</p>}
                        <div className='flex gap-4 mt-4'>
                            <Button onClick={closeModal} className='w-full py-4' disabled={submitting}>Cancel</Button>
                            <Button htmlType='submit' type='primary' className='w-full py-4' disabled={!category || !description.trim() || submitting} loading={submitting}>Submit</Button>
                        </div>
                    </form>
                )}
            </div>
        </>
    )
}

export default FeedbackModal
