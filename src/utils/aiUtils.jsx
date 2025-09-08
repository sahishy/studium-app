import { getGenerativeModel, Schema } from "firebase/ai";
import { ai } from "../lib/firebase";

const ProcessTask = async ( input, subjects ) => {

    const jsonSchema = Schema.object({
        properties: {
            title: Schema.string(),
            subjectId: Schema.string( { nullable: true } ),
            dueDate: Schema.string( { nullable: true } ),
            dueDateExplanation: Schema.string( { nullable: true } )
        },
    });

    const model = getGenerativeModel(ai, {
        model: 'gemini-2.0-flash-001',
        systemInstruction: `
            Given the current day, the first day the user's school started, and the user's subjects, generate a task.

            IMPORTANT RULES:
            - A/B days alternate every day. (For example, if first day was an A day on the 15th, the 16th would be a B day, and the 17th would be an A day, and the 18th would be a B day, and so on).
            - The days that classes are on will be used to determine a due date if necessary. (For example, if a user must finish notes for one of their A day classes by next class, the due date will be the next A day)
            - Classes are only on weekdays.

            OUTPUT FORMAT: 
            {
                "title": string - The title of the generated task.
                "subjectId": string | null - The id of the best fitting subject for the task.
                "dueDate": string | null - The due date of the task in YYYY-MM-DD format.
                "dueDateExplanation": string | null - The explanation behind how the due date was achieved.
            
            }

            Only return one task. No extra text.
        `,
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: jsonSchema
        },
    })

    const today = new Date();
    const firstDay = new Date('2025-08-21');
    const firstDayType = 'A'
    const promptSubjects = subjects.map((subject) => (
        {
            title: subject.title,
            day: subject.day,
            uid: subject.uid
        }
    ))

    const prompt = `
        --- Important Info ---

        Today is ${today.toLocaleString('en-US', { weekday: 'long' })}, ${today.toISOString().split('T')[0]}. 
        First day was ${firstDay.toLocaleString('en-US', { weekday: 'long' })}, ${firstDayType === 'A' ? `an A` : `a B`} day, ${firstDay.toISOString().split('T')[0]}
        
        User subjects:
        ${JSON.stringify(promptSubjects)}

        --- User Input ---

        ${input}

    `

    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text());
}

export { ProcessTask }