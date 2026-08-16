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

