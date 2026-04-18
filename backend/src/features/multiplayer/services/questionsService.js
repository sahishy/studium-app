import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const QUESTIONS_FILE_PATH = path.resolve(__dirname, '../../../data/dsat_questions.json')

const LETTER_CHOICES = ['A', 'B', 'C', 'D']

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

const normalizeDsatEnglishQuestion = ([entryKey, entry], i) => {

    const content = entry?.content ?? {}
    const answerOptions = Array.isArray(content?.answerOptions) ? content.answerOptions : []
    const answerLetter = String(content?.correct_answer?.[0] ?? '').trim().toUpperCase()
    const answerIndex = LETTER_CHOICES.indexOf(answerLetter)

    const choices = answerOptions.map((option, index) => ({
        id: LETTER_CHOICES[index] ?? String(index + 1),
        label: option?.content ?? '',
    }))

    if(!choices.length || answerIndex < 0 || !choices[answerIndex]) {
        return null
    }

    return {
        id: entry?.uId ?? entryKey ?? entry?.questionId ?? `dsat-question-${i}`,
        prompt: content?.stem ?? content?.prompt ?? 'Untitled question',
        paragraph: content?.stimulus ?? null,
        choices,
        correctAnswer: choices[answerIndex].id,
        domain: entry?.primary_class_cd_desc ?? entry?.skill_desc ?? null,
        difficulty: normalizeDifficulty(entry?.difficulty),
    }

}

const loadQuestions = () => {

    const raw = fs.readFileSync(QUESTIONS_FILE_PATH, 'utf8')
    const parsed = JSON.parse(raw)

    const questions = Object.entries(parsed ?? {})
        .filter(([, entry]) => String(entry?.module ?? '').toLowerCase() === 'english')
        .map(normalizeDsatEnglishQuestion)
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
