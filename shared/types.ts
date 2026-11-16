export type StudySubject =
  | 'Science'
  | 'Mathematics'
  | 'English'
  | 'General Knowledge'
  | 'Programming';

export type StudyLevel =
  | 'Beginner'
  | 'SSC'
  | 'HSC'
  | 'University'
  | 'Job Preparation';

export type StudyStyle =
  | 'Short Summary'
  | 'Detailed Explanation'
  | 'Flashcard Points';

export type OutputLanguage = 'bengali' | 'english' | 'both';

export type QuizDifficulty = 'Easy' | 'Medium' | 'Hard';

export type QuizOptionKey = 'A' | 'B' | 'C' | 'D';

export interface FlashcardItem {
  id: string;
  front: string;
  back: string;
  hint?: string;
}

export interface StudyExplanationResponse {
  title: string;
  subject: StudySubject;
  level: StudyLevel;
  style: StudyStyle;
  language: OutputLanguage;
  simpleExplanation: string;
  conceptDefinition: string;
  realWorldAnalogy: string;
  practicalExamples: string[];
  importantPoints: string[];
  summary: string;
  flashcards?: FlashcardItem[];
  modelUsed: string;
}

export interface QuizQuestionPublic {
  id: string;
  question: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
}

export interface QuizGenerateResponse {
  quizId: string;
  subject: StudySubject;
  topic: string;
  difficulty: QuizDifficulty;
  totalQuestions: number;
  questions: QuizQuestionPublic[];
  modelUsed: string;
}

export interface QuizCheckRequest {
  quizId: string;
  questionId: string;
  selectedOption: QuizOptionKey;
}

export interface QuizCheckResponse {
  questionId: string;
  selectedOption: QuizOptionKey;
  correctOption: QuizOptionKey;
  isCorrect: boolean;
  explanation: string;
}

export interface StudyPlanDay {
  day: string;
  focusSubject: string;
  topics: string[];
  durationMinutes: number;
  activity: string;
}

export interface StudyPlanResponse {
  title: string;
  goalSummary: string;
  weeklyHours: number;
  days: StudyPlanDay[];
  tips: string[];
  modelUsed: string;
}

export interface TutorMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  studyPlan?: StudyPlanResponse;
  error?: {
    messageEn: string;
    messageBn: string;
    retryPrompt?: string;
  };
}

export interface ModelInfo {
  id: string;
  displayName: string;
  description?: string;
  isDefault?: boolean;
}

export type ConnectionState = 'connected' | 'not_configured' | 'error';

export interface HealthResponse {
  status: ConnectionState;
  hasEnvKey: boolean;
  hasAdminKey: boolean;
  hasSessionKey: boolean;
  defaultModel: string;
  timestamp: string;
}

export interface AdminLoginResponse {
  adminToken: string;
  username: string;
}

export interface AdminStatusResponse {
  authenticated: boolean;
  username: string;
  connectionStatus: ConnectionState;
  activeKeySource: 'env' | 'admin' | 'none';
  hasEnvKey: boolean;
  hasAdminKey: boolean;
  adminKeyMask: string | null;
  defaultModel: string;
  activeQuizSessions: number;
  totalApiRequests: number;
  uptimeSeconds: number;
}

export interface ModelsResponse {
  configured: boolean;
  defaultModel: string;
  models: ModelInfo[];
  messageEn?: string;
  messageBn?: string;
}

export interface TestConnectionResponse {
  ok: boolean;
  model: string;
  latencyMs: number;
  sampleReply: string;
}

export interface ApiErrorPayload {
  error: {
    code:
      | 'MISSING_API_KEY'
      | 'INVALID_API_KEY'
      | 'RATE_LIMITED'
      | 'SAFETY_BLOCKED'
      | 'MODEL_NOT_FOUND'
      | 'INVALID_AI_OUTPUT'
      | 'TIMEOUT'
      | 'VALIDATION_ERROR'
      | 'UNAUTHORIZED'
      | 'QUIZ_SESSION_NOT_FOUND'
      | 'NETWORK_ERROR'
      | 'INTERNAL_ERROR';
    messageEn: string;
    messageBn: string;
    retryAfterSeconds?: number;
  };
}
