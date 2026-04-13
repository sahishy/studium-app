import questionsData from '../../../data/questions.json'
import dsatQuestionsData from '../../../data/dsat_questions.json'

const shuffle = (arr) => {
    const out = [...arr]
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
            ;[out[i], out[j]] = [out[j], out[i]]
    }
    return out
}

const LETTER_CHOICES = ['A', 'B', 'C', 'D']

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

const normalizedQuestions = questionsData.map((entry, i) => {
    const q = entry?.question ?? {}
    return {
        id: entry?.id ?? `question-${i}`,
        prompt: q.question ?? 'Untitled question',
        paragraph: q.paragraph ?? null,
        choices: Object.entries(q.choices ?? {}).map(([id, label]) => ({ id, label })),
        correctAnswer: q.correct_answer ?? null,
        domain: entry?.domain ?? null,
        difficulty: entry?.difficulty ?? null,
    }
})

const normalizedDsatEnglishQuestions = Object.entries(dsatQuestionsData ?? {})
    .filter(([, entry]) => String(entry?.module ?? '').toLowerCase() === 'english')
    .map(normalizeDsatEnglishQuestion)
    .filter(Boolean)

const activeQuestions = normalizedDsatEnglishQuestions.length
    ? normalizedDsatEnglishQuestions
    : normalizedQuestions

const questionMap = Object.fromEntries(activeQuestions.map((q) => [q.id, q]))

export const getRandomQuestions = ({ count = 5 } = {}) =>
    shuffle(activeQuestions).slice(0, Math.max(1, count))

export const getQuestionById = (id) => questionMap[id] ?? null

export const getQuestionsByIds = (ids = []) =>
    ids.map((id) => questionMap[id]).filter(Boolean)