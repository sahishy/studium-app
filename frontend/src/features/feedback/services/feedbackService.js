import { post } from '../../../shared/services/apiService.jsx'

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

export const validateFeedbackImage = (file) => {
    if (!IMAGE_TYPES.includes(file.type)) return 'Choose a PNG, JPG, WebP, or GIF image.'
    if (!file.size || file.size > MAX_IMAGE_BYTES) return 'Choose an image smaller than 5 MB.'
    return ''
}

const readImage = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.onerror = () => reject(new Error('Could not read your image. Please select it again.'))
    reader.readAsDataURL(file)
})

export const submitFeedback = async (description, file, category) => {
    const attachment = file ? { type: file.type, data: await readImage(file) } : null
    return post('/v1/feedback', { description: description.trim(), attachment, category })
}
