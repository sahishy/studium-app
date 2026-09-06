const comparable = (value: unknown) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, "");

export const isCorrectSatAnswer = (question: any, response: string) => (
  String(question?.questionType).toLowerCase() === "spr"
    ? (question?.acceptableAnswersComparable ?? []).includes(comparable(response))
    : response.toUpperCase() === question?.correctAnswer
);

export const sanitizeSatQuestion = (question: any) => question
  ? Object.fromEntries(Object.entries(question).filter(([key]) => ![
    "correctAnswer",
    "correctAnswerDisplay",
    "acceptableAnswers",
    "acceptableAnswersComparable",
  ].includes(key)))
  : null;

export const buildReviewQuestionsById = (questionsById: Record<string, any> = {}, events: Array<Record<string, any>> = []) => {
  const resolvedIds = new Set(events
    .filter((event) => event?.type === "QUESTION_RESOLVED" || event?.type === "ROUND_RESOLVED")
    .map((event) => String(event?.data?.questionId ?? ""))
    .filter(Boolean));
  return Object.fromEntries([...resolvedIds]
    .map((questionId) => [questionId, sanitizeSatQuestion(questionsById[questionId])])
    .filter(([, question]) => Boolean(question)));
};
