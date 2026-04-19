import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const QUESTIONS_FILE_PATH = path.resolve(__dirname, '../../../data/dsat_questions.json')

const LETTER_CHOICES = ['A', 'B', 'C', 'D']
const SUPPORTED_MODULES = new Set(['english', 'math'])

const shuffle = (arr) => {

    const out = [...arr]

    for(let i = out.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[out[i], out[j]] = [out[j], out[i]]
    }

    return out

}

const normalizeDifficulty = (difficultyCode) => {

    const normalizedCode = String(difficultyCode ?? '').trim().toUpperCase()

    if(normalizedCode === 'E') return 'Easy'
    if(normalizedCode === 'M') return 'Medium'
    if(normalizedCode === 'H') return 'Hard'

    return difficultyCode ?? null

}

const stripHtml = (value) => String(value ?? '')
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const toArray = (value) => {
    if(Array.isArray(value)) {
        return value
    }

    if(value == null) {
        return []
    }

    return [value]
}

const cleanAnswerValue = (value) => String(value ?? '')
    .replace(/<img[^>]*alt=["']([^"']+)["'][^>]*>/gi, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .trim()
    .replace(/^['"`]|['"`]$/g, '')
    .replace(/^[=:]\s*/, '')
    .replace(/[\s.]+$/g, '')
    .replace(/\s+/g, ' ')

const normalizeSprComparableValue = (value) => cleanAnswerValue(value)
    .toLowerCase()
    .replace(/\s+/g, '')

const getQuestionPrompt = (content = {}) => (
    content?.stem
    ?? content?.prompt
    ?? content?.question
    ?? 'Untitled question'
)

const getQuestionParagraph = (content = {}) => (
    content?.stimulus
    ?? content?.passage
    ?? null
)

const normalizeChoiceLabel = (choice) => {
    if(typeof choice === 'string') {
        return choice
    }

    return choice?.content
        ?? choice?.label
        ?? choice?.text
        ?? choice?.value
        ?? ''
}

const normalizeChoices = (choiceEntries = []) => choiceEntries
    .map((choice, index) => ({
        id: LETTER_CHOICES[index] ?? String(index + 1),
        label: normalizeChoiceLabel(choice),
    }))
    .filter((choice) => String(choice.label ?? '').trim().length > 0)

const resolveMcqCorrectAnswerId = ({ rawCorrectAnswer, choices = [] }) => {

    const candidates = toArray(rawCorrectAnswer)
        .map((value) => String(value ?? '').trim())
        .filter(Boolean)

    for(const candidate of candidates) {
        const normalized = candidate.toUpperCase().replace(/[()\s]/g, '')

        const byLetter = choices.find((choice) => choice.id === normalized)
        if(byLetter) {
            return byLetter.id
        }

        const letterMatch = normalized.match(/[A-D]/)
        if(letterMatch) {
            const byMatch = choices.find((choice) => choice.id === letterMatch[0])
            if(byMatch) {
                return byMatch.id
            }
        }

        const numeric = Number(normalized)
        if(Number.isFinite(numeric)) {
            const oneBased = choices[Math.round(numeric) - 1]
            if(oneBased) {
                return oneBased.id
            }

            const zeroBased = choices[Math.round(numeric)]
            if(zeroBased) {
                return zeroBased.id
            }
        }

        const byLabel = choices.find((choice) => stripHtml(choice.label).trim() === stripHtml(candidate).trim())
        if(byLabel) {
            return byLabel.id
        }
    }

    return null

}

const getRationaleText = (entry = {}, content = {}) => {
    const answer = content?.answer
    return [
        entry?.rationale,
        content?.rationale,
        answer?.rationale,
    ].map((value) => String(value ?? '').trim()).filter(Boolean).join(' ')
}

const extractSprAnswersFromRationale = (rationaleText = '') => {
    const text = stripHtml(rationaleText)

    const directMatch = text.match(/The correct answer is\s+(.+?)(?:\.|$)/i)
    const directValue = cleanAnswerValue(directMatch?.[1] ?? '')

    const noteMatch = text.match(/Note that\s+(.+?)\s+are examples of ways to enter a correct answer\.?/i)
    const listRaw = noteMatch?.[1]
        ? noteMatch[1]
            .replace(/\sand\s/gi, ',')
            .split(',')
            .map((entryValue) => cleanAnswerValue(entryValue))
            .filter(Boolean)
        : []

    if(listRaw.length) {
        return [...new Set(listRaw)]
    }

    if(directValue) {
        return [directValue]
    }

    return []
}

const normalizeSprAcceptableAnswers = ({ content = {}, rationaleText = '' }) => {

    const explicitAnswers = []

    if(Array.isArray(content?.correct_answer)) {
        explicitAnswers.push(...content.correct_answer)
    } else if(content?.correct_answer != null) {
        explicitAnswers.push(content.correct_answer)
    }

    if(Array.isArray(content?.answer?.correct_answer)) {
        explicitAnswers.push(...content.answer.correct_answer)
    } else if(content?.answer?.correct_answer != null) {
        explicitAnswers.push(content.answer.correct_answer)
    }

    const cleanedExplicit = explicitAnswers
        .map((value) => cleanAnswerValue(value))
        .filter(Boolean)

    if(cleanedExplicit.length) {
        return [...new Set(cleanedExplicit)]
    }

    return extractSprAnswersFromRationale(rationaleText)

}

const normalizeDsatQuestion = ([entryKey, entry], i) => {

    const content = entry?.content ?? {}
    const answer = content?.answer ?? {}
    const module = String(entry?.module ?? '').trim().toLowerCase()

    if(!SUPPORTED_MODULES.has(module)) {
        return null
    }

    const rawContentType = String(content?.type ?? '').trim().toLowerCase()
    const rawAnswerStyle = String(answer?.style ?? '').trim().toLowerCase()

    const hasNewFormatType = rawContentType === 'mcq' || rawContentType === 'spr'
    const hasChoicesInNewFormat = Array.isArray(content?.answerOptions)
    const hasChoicesInLegacyFormat = Array.isArray(answer?.choices)

    const questionType = hasNewFormatType
        ? rawContentType
        : (rawAnswerStyle === 'spr' || rawAnswerStyle === 'mcq'
            ? rawAnswerStyle
            : ((hasChoicesInNewFormat || hasChoicesInLegacyFormat) ? 'mcq' : 'spr'))

    const questionId = entry?.uId ?? entryKey ?? entry?.questionId ?? `dsat-question-${i}`
    const rationaleText = getRationaleText(entry, content)

    const baseQuestion = {
        id: questionId,
        body: content?.body ?? null,
        prompt: getQuestionPrompt(content),
        paragraph: getQuestionParagraph(content),
        domain: entry?.primary_class_cd_desc ?? entry?.skill_desc ?? null,
        difficulty: normalizeDifficulty(entry?.difficulty),
        module,
        questionType,
    }

    if(questionType === 'mcq') {
        const rawChoiceEntries = hasChoicesInNewFormat
            ? content.answerOptions
            : (hasChoicesInLegacyFormat ? answer.choices : [])

        const choices = normalizeChoices(rawChoiceEntries)
        if(!choices.length) {
            return null
        }

        const correctAnswer = resolveMcqCorrectAnswerId({
            rawCorrectAnswer: hasChoicesInNewFormat
                ? content?.correct_answer
                : (answer?.correct_choice ?? content?.correct_answer),
            choices,
        })

        if(!correctAnswer) {
            return null
        }

        return {
            ...baseQuestion,
            choices,
            correctAnswer,
            acceptableAnswers: [],
        }
    }

    const acceptableAnswers = normalizeSprAcceptableAnswers({
        content,
        rationaleText,
    })

    if(!acceptableAnswers.length) {
        return null
    }

    const preferredSprDisplayAnswer = acceptableAnswers.find((value) => /\d/.test(value)) ?? acceptableAnswers[0]

    return {
        ...baseQuestion,
        choices: [],
        correctAnswer: preferredSprDisplayAnswer,
        correctAnswerDisplay: preferredSprDisplayAnswer,
        acceptableAnswers,
        acceptableAnswersComparable: acceptableAnswers.map((value) => normalizeSprComparableValue(value)),
    }

}

const loadQuestions = () => {

    const raw = fs.readFileSync(QUESTIONS_FILE_PATH, 'utf8')
    const parsed = JSON.parse(raw)

    const questions = Object.entries(parsed ?? {})
        .map(normalizeDsatQuestion)
        .filter(Boolean)

    return questions

}

const cachedQuestions = loadQuestions()
const questionMap = Object.fromEntries(cachedQuestions.map((question) => [question.id, question]))

const getRandomQuestions = ({ count = 5 } = {}) => {

    const safeCount = Math.max(1, Number(count) || 1)
    return shuffle(cachedQuestions).slice(0, safeCount)
    
}

const getQuestionById = (id) => questionMap[id] ?? null

const getQuestionsByIds = (ids = []) => ids.map((id) => questionMap[id]).filter(Boolean)

export {
    getRandomQuestions,
    getQuestionById,
    getQuestionsByIds,
}
