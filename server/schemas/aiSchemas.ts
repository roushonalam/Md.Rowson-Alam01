import { z } from 'zod';

export const StudySubjectSchema = z.enum([
  'Science',
  'Mathematics',
  'English',
  'General Knowledge',
  'Programming',
]);

export const StudyLevelSchema = z.enum([
  'Beginner',
  'SSC',
  'HSC',
  'University',
  'Job Preparation',
]);

export const StudyStyleSchema = z.enum([
  'Short Summary',
  'Detailed Explanation',
  'Flashcard Points',
]);

export const OutputLanguageSchema = z.enum(['bengali', 'english', 'both']);

export const QuizDifficultySchema = z.enum(['Easy', 'Medium', 'Hard']);

export const QuizOptionKeySchema = z.enum(['A', 'B', 'C', 'D']);

export const TemperatureSchema = z.number().min(0.2).max(0.7).default(0.4);

export const ModelIdSchema = z
  .string()
  .trim()
  .min(2)
  .max(120)
  .regex(/^[a-zA-Z0-9._:/-]+$/, 'Invalid model identifier')
  .optional();

export const ExplainRequestSchema = z.object({
  subject: StudySubjectSchema,
  level: StudyLevelSchema,
  style: StudyStyleSchema,
  language: OutputLanguageSchema.default('both'),
  topic: z
    .string()
    .trim()
    .min(2, 'Please enter a topic of at least 2 characters.')
    .max(1000, 'Topic cannot exceed 1000 characters.'),
  model: ModelIdSchema,
  temperature: TemperatureSchema.optional(),
});

export const FlashcardItemSchema = z.object({
  id: z.string().trim().min(1),
  front: z.string().trim().min(2),
  back: z.string().trim().min(2),
  hint: z.string().trim().optional(),
});

export const ExplainAiOutputSchema = z.object({
  title: z.string().trim().min(2),
  simpleExplanation: z.string().trim().min(10),
  conceptDefinition: z.string().trim().min(10),
  realWorldAnalogy: z.string().trim().min(10),
  practicalExamples: z.array(z.string().trim().min(3)).min(1),
  importantPoints: z.array(z.string().trim().min(3)).min(1),
  summary: z.string().trim().min(10),
  flashcards: z.array(FlashcardItemSchema).optional(),
});

export const QuizGenerateRequestSchema = z.object({
  subject: StudySubjectSchema,
  topic: z
    .string()
    .trim()
    .min(2, 'Please enter a chapter or topic.')
    .max(400, 'Topic cannot exceed 400 characters.'),
  difficulty: QuizDifficultySchema,
  count: z.union([z.literal(5), z.literal(10)]),
  model: ModelIdSchema,
  temperature: TemperatureSchema.optional(),
});

export const QuizAiQuestionSchema = z
  .object({
    question: z.string().trim().min(5),
    options: z.object({
      A: z.string().trim().min(1),
      B: z.string().trim().min(1),
      C: z.string().trim().min(1),
      D: z.string().trim().min(1),
    }),
    correctOption: QuizOptionKeySchema,
    explanation: z.string().trim().min(5),
  })
  .refine(
    (q) => {
      const normalized = [
        q.options.A.toLowerCase(),
        q.options.B.toLowerCase(),
        q.options.C.toLowerCase(),
        q.options.D.toLowerCase(),
      ];
      return new Set(normalized).size === 4;
    },
    { message: 'All 4 quiz options must be distinct.' }
  );

export function createQuizAiOutputSchema(expectedCount: number) {
  return z.object({
    questions: z
      .array(QuizAiQuestionSchema)
      .length(expectedCount, `Expected exactly ${expectedCount} questions.`),
  });
}

export const QuizCheckRequestSchema = z.object({
  quizId: z.string().trim().min(8).max(128),
  questionId: z.string().trim().min(1).max(64),
  selectedOption: QuizOptionKeySchema,
});

export const TutorHistoryItemSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1).max(4000),
});

export const TutorChatRequestSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, 'Message cannot be empty.')
    .max(2000, 'Message cannot exceed 2000 characters.'),
  history: z.array(TutorHistoryItemSchema).max(20).default([]),
  model: ModelIdSchema,
  temperature: TemperatureSchema.optional(),
  stream: z.boolean().optional().default(true),
});

export const StudyPlanRequestSchema = z.object({
  goal: z
    .string()
    .trim()
    .min(3, 'Please describe your study goal.')
    .max(1000, 'Study goal cannot exceed 1000 characters.'),
  language: OutputLanguageSchema.optional().default('both'),
  model: ModelIdSchema,
  temperature: TemperatureSchema.optional(),
});

export const StudyPlanDaySchema = z.object({
  day: z.string().trim().min(2),
  focusSubject: z.string().trim().min(2),
  topics: z.array(z.string().trim().min(2)).min(1),
  durationMinutes: z.number().int().min(15).max(720),
  activity: z.string().trim().min(3),
});

export const StudyPlanAiOutputSchema = z.object({
  title: z.string().trim().min(3),
  goalSummary: z.string().trim().min(5),
  weeklyHours: z.number().min(1).max(112),
  days: z.array(StudyPlanDaySchema).length(7),
  tips: z.array(z.string().trim().min(3)).min(1),
});

export const TestConnectionRequestSchema = z.object({
  model: ModelIdSchema,
});

export const SessionKeyRequestSchema = z.object({
  apiKey: z
    .string()
    .trim()
    .min(16, 'Please enter a valid Gemini API key.')
    .max(256, 'API key length is invalid.'),
});

export const AdminLoginRequestSchema = z.object({
  username: z.string().trim().min(2, 'Username is required.').max(80),
  password: z.string().min(4, 'Password is required.').max(128),
});

export const AdminApiKeyRequestSchema = z.object({
  apiKey: z
    .string()
    .trim()
    .min(16, 'Please enter a valid Gemini API key.')
    .max(256, 'API key length is invalid.'),
  skipVerify: z.boolean().optional().default(false),
});

export const AdminDefaultModelSchema = z.object({
  model: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .regex(/^[a-zA-Z0-9._:/-]+$/, 'Invalid model identifier'),
});
