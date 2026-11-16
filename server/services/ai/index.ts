import crypto from 'node:crypto';
import { GoogleGenAI, ThinkingLevel, Type, type Content, type Schema } from '@google/genai';
import type { z } from 'zod';
import { getAdminRuntimeDefaultModel } from '../adminAuth.ts';
import {
  ExplainAiOutputSchema,
  StudyPlanAiOutputSchema,
  createQuizAiOutputSchema,
} from '../../schemas/aiSchemas.ts';
import type {
  ApiErrorPayload,
  ModelInfo,
  OutputLanguage,
  QuizCheckRequest,
  QuizCheckResponse,
  QuizDifficulty,
  QuizGenerateResponse,
  QuizOptionKey,
  StudyExplanationResponse,
  StudyLevel,
  StudyPlanResponse,
  StudyStyle,
  StudySubject,
} from '../../../shared/types.ts';

export class AiServiceError extends Error {
  public readonly statusCode: number;
  public readonly code: ApiErrorPayload['error']['code'];
  public readonly messageEn: string;
  public readonly messageBn: string;
  public readonly retryAfterSeconds?: number;

  constructor(params: {
    statusCode: number;
    code: ApiErrorPayload['error']['code'];
    messageEn: string;
    messageBn: string;
    retryAfterSeconds?: number;
  }) {
    super(params.messageEn);
    this.name = 'AiServiceError';
    this.statusCode = params.statusCode;
    this.code = params.code;
    this.messageEn = params.messageEn;
    this.messageBn = params.messageBn;
    this.retryAfterSeconds = params.retryAfterSeconds;
  }

  toPayload(): ApiErrorPayload {
    return {
      error: {
        code: this.code,
        messageEn: this.messageEn,
        messageBn: this.messageBn,
        ...(this.retryAfterSeconds !== undefined
          ? { retryAfterSeconds: this.retryAfterSeconds }
          : {}),
      },
    };
  }
}

export const TUTOR_SYSTEM_INSTRUCTION =
  'You are EduGenius AI, an intelligent and encouraging educational mentor for Bengali and English-speaking students. Always: 1) explain difficult concepts in simple language; 2) structure answers as Concept Definition, Real-world Analogy, Practical Example; 3) reply in the language the student uses; 4) give accurate, structured answers; 5) ask a clarifying question when the topic is unclear; 6) never invent facts or present uncertain information as verified, and say when you are unsure; 7) encourage learning, guide step by step and check understanding rather than just handing over answers.';

const AI_TIMEOUT_MS = 60_000;
const QUIZ_SESSION_TTL_MS = 2 * 60 * 60 * 1000;

interface StoredQuizQuestion {
  id: string;
  correctOption: QuizOptionKey;
  explanation: string;
}

interface StoredQuizSession {
  quizId: string;
  createdAt: number;
  questions: Map<string, StoredQuizQuestion>;
}

const quizSessionStore = new Map<string, StoredQuizQuestion extends never ? never : StoredQuizSession>();

const quizCleanupTimer = setInterval(() => {
  const cutoff = Date.now() - QUIZ_SESSION_TTL_MS;
  for (const [id, session] of quizSessionStore.entries()) {
    if (session.createdAt < cutoff) {
      quizSessionStore.delete(id);
    }
  }
}, 15 * 60 * 1000);
quizCleanupTimer.unref();

export function getActiveQuizSessionCount(): number {
  return quizSessionStore.size;
}

export function getDefaultModel(): string {
  const adminModel = getAdminRuntimeDefaultModel();
  if (adminModel) return adminModel;
  const configured = process.env.GEMINI_DEFAULT_MODEL?.trim();
  return configured && configured.length > 0 ? configured : 'gemini-4-hydrogen';
}

function createGenAIClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function isGemini4Model(modelId: string): boolean {
  return /^gemini-4-/i.test(modelId.trim());
}

function applyTemperatureIfSupported(
  modelId: string,
  config: Record<string, unknown>,
  temperature?: number
): Record<string, unknown> {
  if (isGemini4Model(modelId)) {
    return {
      ...config,
      thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
    };
  }
  if (temperature !== undefined) {
    return { ...config, temperature };
  }
  return config;
}

async function withTimeout<T>(promise: Promise<T>, ms = AI_TIMEOUT_MS): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new AiServiceError({
          statusCode: 504,
          code: 'TIMEOUT',
          messageEn: 'The AI request timed out. Please try again.',
          messageBn: 'AI অনুরোধের সময় শেষ হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।',
        })
      );
    }, ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractRetrySeconds(err: unknown): number {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  const match = msg.match(/retry\s*(?:in|after)?\s*(\d+(?:\.\d+)?)\s*s/i);
  if (match) {
    const parsed = Math.ceil(Number(match[1]));
    if (Number.isFinite(parsed) && parsed > 0 && parsed <= 120) {
      return parsed;
    }
  }
  return 15;
}

export function mapUnknownErrorToAiError(err: unknown): AiServiceError {
  if (err instanceof AiServiceError) {
    return err;
  }

  const rawMsg = err instanceof Error ? err.message : String(err ?? 'Unknown error');
  const lower = rawMsg.toLowerCase();
  const status =
    typeof err === 'object' && err !== null && 'status' in err
      ? Number((err as { status?: unknown }).status)
      : undefined;

  if (
    status === 429 ||
    lower.includes('429') ||
    lower.includes('resource_exhausted') ||
    lower.includes('quota') ||
    lower.includes('rate limit')
  ) {
    const retryAfterSeconds = extractRetrySeconds(err);
    return new AiServiceError({
      statusCode: 429,
      code: 'RATE_LIMITED',
      messageEn: `AI rate limit reached. Please try again in ${retryAfterSeconds} seconds.`,
      messageBn: `AI অনুরোধের সীমা পূর্ণ হয়েছে। অনুগ্রহ করে ${retryAfterSeconds} সেকেন্ড পর আবার চেষ্টা করুন।`,
      retryAfterSeconds,
    });
  }

  if (
    status === 401 ||
    status === 403 ||
    lower.includes('api_key_invalid') ||
    lower.includes('api key not valid') ||
    lower.includes('permission_denied') ||
    lower.includes('unauthorized')
  ) {
    return new AiServiceError({
      statusCode: 401,
      code: 'INVALID_API_KEY',
      messageEn: 'The Gemini API key was rejected. Please verify your key configuration.',
      messageBn: 'Gemini API কী গ্রহণ করা হয়নি। অনুগ্রহ করে আপনার কী কনফিগারেশন যাচাই করুন।',
    });
  }

  if (status === 404 || lower.includes('not_found') || lower.includes('model not found')) {
    return new AiServiceError({
      statusCode: 404,
      code: 'MODEL_NOT_FOUND',
      messageEn: 'The selected Gemini model is unavailable. Try switching models in Settings.',
      messageBn: 'নির্বাচিত Gemini মডেলটি পাওয়া যায়নি। সেটিংস থেকে অন্য মডেল নির্বাচন করুন।',
    });
  }

  if (
    lower.includes('safety') ||
    lower.includes('blocked') ||
    lower.includes('prohibited')
  ) {
    return new AiServiceError({
      statusCode: 422,
      code: 'SAFETY_BLOCKED',
      messageEn: 'The response was blocked by safety filters. Please rephrase your topic.',
      messageBn: 'নিরাপত্তা ফিল্টারের কারণে উত্তরটি তৈরি করা যায়নি। অনুগ্রহ করে বিষয়টি ভিন্নভাবে লিখুন।',
    });
  }

  if (
    lower.includes('fetch failed') ||
    lower.includes('enotfound') ||
    lower.includes('econnrefused') ||
    lower.includes('network')
  ) {
    return new AiServiceError({
      statusCode: 503,
      code: 'NETWORK_ERROR',
      messageEn: 'Unable to reach the Gemini API due to a network error. Please try again.',
      messageBn: 'নেটওয়ার্ক সমস্যার কারণে Gemini API-এর সাথে সংযোগ করা যায়নি। আবার চেষ্টা করুন।',
    });
  }

  return new AiServiceError({
    statusCode: 500,
    code: 'INTERNAL_ERROR',
    messageEn: 'An unexpected AI service error occurred. Please try again.',
    messageBn: 'AI সেবায় একটি অপ্রত্যাশিত ত্রুটি হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।',
  });
}

async function withRateLimitBackoff<T>(fn: () => Promise<T>): Promise<T> {
  const delays = [1000, 2000];
  let lastErr: unknown;

  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return await withTimeout(fn());
    } catch (err) {
      lastErr = err;
      const mapped = mapUnknownErrorToAiError(err);
      if (mapped.code === 'RATE_LIMITED' && attempt < delays.length) {
        const waitMs = Math.min(delays[attempt], (mapped.retryAfterSeconds ?? 2) * 1000);
        if (waitMs <= 2500) {
          await sleep(waitMs);
          continue;
        }
      }
      throw mapped;
    }
  }

  throw mapUnknownErrorToAiError(lastErr);
}

function stripCodeFences(raw: string): string {
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  // Extract outermost JSON object if wrapped by stray prose
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }
  return cleaned;
}

function assertNotSafetyBlocked(response: {
  candidates?: Array<{ finishReason?: string }>;
  promptFeedback?: { blockReason?: string };
}): void {
  const blockReason = response.promptFeedback?.blockReason;
  const finishReason = response.candidates?.[0]?.finishReason;
  const blockedReasons = new Set(['SAFETY', 'RECITATION', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII']);

  if (
    (blockReason && blockedReasons.has(String(blockReason).toUpperCase())) ||
    (finishReason && blockedReasons.has(String(finishReason).toUpperCase()))
  ) {
    throw new AiServiceError({
      statusCode: 422,
      code: 'SAFETY_BLOCKED',
      messageEn: 'Your request could not be completed due to safety guidelines. Please revise the prompt.',
      messageBn: 'নিরাপত্তা নীতিমালার কারণে অনুরোধটি সম্পন্ন করা যায়নি। অনুগ্রহ করে প্রশ্নটি পরিবর্তন করে চেষ্টা করুন।',
    });
  }
}

async function generateStructuredJson<T>(params: {
  apiKey: string;
  model: string;
  contents: string;
  systemInstruction: string;
  responseSchema: Schema;
  zodSchema: z.ZodType<T>;
  temperature?: number;
  maxRetries?: number;
}): Promise<T> {
  const ai = createGenAIClient(params.apiKey);
  const maxRetries = params.maxRetries ?? 2;
  let lastValidationIssue = '';

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const promptText =
      attempt === 0
        ? params.contents
        : `${params.contents}\n\nIMPORTANT CORRECTION: Your previous output failed strict schema validation (${lastValidationIssue}). Return ONLY valid JSON matching every required field and constraint.`;

    const config = applyTemperatureIfSupported(
      params.model,
      {
        systemInstruction: params.systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: params.responseSchema,
      },
      params.temperature
    );

    const response = await withRateLimitBackoff(() =>
      ai.models.generateContent({
        model: params.model,
        contents: promptText,
        config,
      })
    );

    assertNotSafetyBlocked(response);

    const rawText = response.text ?? '';
    if (!rawText.trim()) {
      lastValidationIssue = 'Empty response from model';
      continue;
    }

    try {
      const parsed = JSON.parse(stripCodeFences(rawText));
      const validated = params.zodSchema.safeParse(parsed);
      if (validated.success) {
        return validated.data;
      }
      lastValidationIssue = validated.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .slice(0, 3)
        .join('; ');
    } catch (parseErr) {
      lastValidationIssue =
        parseErr instanceof Error ? parseErr.message : 'Malformed JSON';
    }
  }

  throw new AiServiceError({
    statusCode: 502,
    code: 'INVALID_AI_OUTPUT',
    messageEn: 'The AI returned an unexpected format after multiple retries. Please try again.',
    messageBn: 'একাধিক চেষ্টার পরও AI থেকে সঠিক ফরম্যাটে উত্তর পাওয়া যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।',
  });
}

export async function listAvailableModels(apiKey: string): Promise<ModelInfo[]> {
  const ai = createGenAIClient(apiKey);
  const defaultModel = getDefaultModel();

  const models: ModelInfo[] = [];
  const seen = new Set<string>();

  try {
    const pager = await withRateLimitBackoff(() => ai.models.list());
    for await (const model of pager) {
      const rawName = model.name ?? '';
      const id = rawName.replace(/^models\//, '').trim();
      if (!id || seen.has(id)) continue;

      const actions = Array.isArray(model.supportedActions)
        ? model.supportedActions
        : [];

      const supportsGenerateContent =
        actions.length > 0
          ? actions.includes('generateContent')
          : id.toLowerCase().includes('gemini');

      const lower = id.toLowerCase();
      const isNonTextModalityOnly =
        lower.includes('embedding') ||
        lower.includes('imagen') ||
        lower.includes('veo') ||
        lower.includes('lyria') ||
        lower.includes('-tts') ||
        lower.includes('transcribe') ||
        lower.includes('image') ||
        lower.includes('live');

      if (!supportsGenerateContent || isNonTextModalityOnly) continue;

      seen.add(id);
      models.push({
        id,
        displayName: model.displayName || id,
        description: model.description || undefined,
        isDefault: id === defaultModel,
      });
    }
  } catch (err) {
    throw mapUnknownErrorToAiError(err);
  }

  // Sort default model first, then Gemini family models, then alphabetical
  models.sort((a, b) => {
    if (a.id === defaultModel) return -1;
    if (b.id === defaultModel) return 1;
    const aGemini = a.id.toLowerCase().startsWith('gemini-');
    const bGemini = b.id.toLowerCase().startsWith('gemini-');
    if (aGemini && !bGemini) return -1;
    if (!aGemini && bGemini) return 1;
    return a.displayName.localeCompare(b.displayName);
  });

  return models;
}

export async function testConnection(
  apiKey: string,
  requestedModel?: string
): Promise<{ ok: boolean; model: string; latencyMs: number; sampleReply: string }> {
  const model = requestedModel?.trim() || getDefaultModel();
  const ai = createGenAIClient(apiKey);
  const started = Date.now();

  const config: Record<string, unknown> = {
    systemInstruction: 'Respond concisely in one short sentence.',
    ...(isGemini4Model(model)
      ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
      : {}),
  };

  const response = await withRateLimitBackoff(() =>
    ai.models.generateContent({
      model,
      contents: 'Reply with exactly: EduGenius connection verified.',
      config,
    })
  );

  assertNotSafetyBlocked(response);
  const reply = (response.text ?? '').trim() || 'Connection verified.';

  return {
    ok: true,
    model,
    latencyMs: Date.now() - started,
    sampleReply: reply.slice(0, 160),
  };
}

function languageDirective(language: OutputLanguage): string {
  switch (language) {
    case 'bengali':
      return 'Write all explanations, analogies, examples, points, and summary in natural, clear Bengali (বাংলা). Keep essential technical/math terms with Bengali explanation.';
    case 'english':
      return 'Write all content in clear, accessible English.';
    case 'both':
      return 'Provide bilingual explanations in BOTH English and Bengali (বাংলা) clearly organized in each field so Bengali and English students both understand effortlessly.';
  }
}

export async function explainTopic(
  params: {
    subject: StudySubject;
    level: StudyLevel;
    style: StudyStyle;
    language: OutputLanguage;
    topic: string;
    model?: string;
    temperature?: number;
  },
  apiKey: string
): Promise<StudyExplanationResponse> {
  const model = params.model?.trim() || getDefaultModel();
  const isFlashcards = params.style === 'Flashcard Points';

  const prompt = `
Create an educational study guide for a student.
Subject: ${params.subject}
Academic Level: ${params.level}
Preferred Style: ${params.style}
Output Language Rule: ${languageDirective(params.language)}
Topic: "${params.topic}"

Formatting rules:
- Use valid LaTeX math wrapped in $...$ for inline formulas and $$...$$ for block equations whenever mathematical, physics, or chemical equations are relevant.
- Keep prose crisp, accurate, and tailored to the ${params.level} level.
${isFlashcards ? '- Generate 6 to 8 high-yield study flashcards in the "flashcards" array, each with a concise front prompt/term, clear back answer, and optional memory hint.' : '- Populate all core sections thoroughly.'}
`.trim();

  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: 'Clear topic title' },
      simpleExplanation: {
        type: Type.STRING,
        description: 'Easy-to-grasp explanation tailored to the level',
      },
      conceptDefinition: {
        type: Type.STRING,
        description: 'Formal, accurate definition of the concept',
      },
      realWorldAnalogy: {
        type: Type.STRING,
        description: 'Relatable everyday analogy helping intuition',
      },
      practicalExamples: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: '2 to 4 worked or real-world examples',
      },
      importantPoints: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: '4 to 6 key exam or takeaway points',
      },
      summary: {
        type: Type.STRING,
        description: 'Concise wrap-up summary',
      },
      ...(isFlashcards
        ? {
            flashcards: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  front: { type: Type.STRING },
                  back: { type: Type.STRING },
                  hint: { type: Type.STRING },
                },
                required: ['id', 'front', 'back'],
              },
            },
          }
        : {}),
    },
    required: [
      'title',
      'simpleExplanation',
      'conceptDefinition',
      'realWorldAnalogy',
      'practicalExamples',
      'importantPoints',
      'summary',
      ...(isFlashcards ? ['flashcards'] : []),
    ],
  };

  const result = await generateStructuredJson({
    apiKey,
    model,
    contents: prompt,
    systemInstruction:
      'You are EduGenius AI, an expert academic curriculum author for Bengali and English students (Class 9-12, SSC, HSC, University, and Job Preparation). Never fabricate facts.',
    responseSchema,
    zodSchema: ExplainAiOutputSchema,
    temperature: params.temperature,
  });

  return {
    ...result,
    subject: params.subject,
    level: params.level,
    style: params.style,
    language: params.language,
    modelUsed: model,
  };
}

export async function generateQuiz(
  params: {
    subject: StudySubject;
    topic: string;
    difficulty: QuizDifficulty;
    count: 5 | 10;
    model?: string;
    temperature?: number;
  },
  apiKey: string
): Promise<QuizGenerateResponse> {
  const model = params.model?.trim() || getDefaultModel();
  const quizSchema = createQuizAiOutputSchema(params.count);

  const prompt = `
Generate a ${params.difficulty}-difficulty multiple-choice quiz with EXACTLY ${params.count} questions.
Subject: ${params.subject}
Chapter/Topic: "${params.topic}"

Requirements:
1. Exactly ${params.count} distinct questions.
2. Each question must have 4 distinct options labeled A, B, C, and D.
3. Exactly one option is correct ("A", "B", "C", or "D").
4. Include a clear, educational explanation for why the correct answer is right.
5. If the topic is written in Bengali, write the quiz in Bengali; otherwise write in English (with LaTeX $...$ if formulas apply).
`.trim();

  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      questions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING },
            options: {
              type: Type.OBJECT,
              properties: {
                A: { type: Type.STRING },
                B: { type: Type.STRING },
                C: { type: Type.STRING },
                D: { type: Type.STRING },
              },
              required: ['A', 'B', 'C', 'D'],
            },
            correctOption: {
              type: Type.STRING,
              enum: ['A', 'B', 'C', 'D'],
            },
            explanation: { type: Type.STRING },
          },
          required: ['question', 'options', 'correctOption', 'explanation'],
        },
      },
    },
    required: ['questions'],
  };

  const data = await generateStructuredJson({
    apiKey,
    model,
    contents: prompt,
    systemInstruction:
      'You are EduGenius AI Quiz Master. Generate accurate, unambiguous academic multiple-choice questions with verified answers and clear explanations.',
    responseSchema,
    zodSchema: quizSchema,
    temperature: params.temperature,
    maxRetries: 2,
  });

  const quizId = crypto.randomUUID();
  const storedMap = new Map<string, StoredQuizQuestion>();

  const publicQuestions = data.questions.map((q, index) => {
    const id = `q_${index + 1}_${crypto.randomBytes(4).toString('hex')}`;
    storedMap.set(id, {
      id,
      correctOption: q.correctOption,
      explanation: q.explanation,
    });
    return {
      id,
      question: q.question,
      options: q.options,
    };
  });

  quizSessionStore.set(quizId, {
    quizId,
    createdAt: Date.now(),
    questions: storedMap,
  });

  return {
    quizId,
    subject: params.subject,
    topic: params.topic,
    difficulty: params.difficulty,
    totalQuestions: publicQuestions.length,
    questions: publicQuestions,
    modelUsed: model,
  };
}

export function checkQuizAnswer(input: QuizCheckRequest): QuizCheckResponse {
  const session = quizSessionStore.get(input.quizId);
  if (!session) {
    throw new AiServiceError({
      statusCode: 404,
      code: 'QUIZ_SESSION_NOT_FOUND',
      messageEn: 'This quiz session has expired. Please generate a new quiz.',
      messageBn: 'এই কুইজ সেশনের মেয়াদ শেষ হয়ে গেছে। অনুগ্রহ করে একটি নতুন কুইজ তৈরি করুন।',
    });
  }

  const question = session.questions.get(input.questionId);
  if (!question) {
    throw new AiServiceError({
      statusCode: 404,
      code: 'QUIZ_SESSION_NOT_FOUND',
      messageEn: 'Question not found in this quiz session.',
      messageBn: 'এই কুইজ সেশনে প্রশ্নটি পাওয়া যায়নি।',
    });
  }

  return {
    questionId: question.id,
    selectedOption: input.selectedOption,
    correctOption: question.correctOption,
    isCorrect: input.selectedOption === question.correctOption,
    explanation: question.explanation,
  };
}

function trimTutorHistory(
  history: Array<{ role: 'user' | 'assistant'; content: string }>
): Content[] {
  const maxTurns = 12;
  const maxTotalChars = 12_000;
  const sliced = history.slice(-maxTurns);

  let charCount = 0;
  const kept: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  for (let i = sliced.length - 1; i >= 0; i--) {
    const item = sliced[i];
    if (charCount + item.content.length > maxTotalChars && kept.length > 0) {
      break;
    }
    charCount += item.content.length;
    kept.unshift(item);
  }

  return kept.map((item) => ({
    role: item.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: item.content }],
  }));
}

export async function tutorChat(
  params: {
    message: string;
    history: Array<{ role: 'user' | 'assistant'; content: string }>;
    model?: string;
    temperature?: number;
  },
  apiKey: string
): Promise<{ reply: string; modelUsed: string }> {
  const model = params.model?.trim() || getDefaultModel();
  const ai = createGenAIClient(apiKey);
  const config = applyTemperatureIfSupported(
    model,
    { systemInstruction: TUTOR_SYSTEM_INSTRUCTION },
    params.temperature
  );

  const chat = ai.chats.create({
    model,
    history: trimTutorHistory(params.history),
    config,
  });

  const response = await withRateLimitBackoff(() =>
    chat.sendMessage({ message: params.message })
  );

  assertNotSafetyBlocked(response);
  const reply = (response.text ?? '').trim();
  if (!reply) {
    throw new AiServiceError({
      statusCode: 502,
      code: 'INVALID_AI_OUTPUT',
      messageEn: 'The AI tutor returned an empty response. Please try again.',
      messageBn: 'AI টিউটর থেকে কোনো উত্তর আসেনি। অনুগ্রহ করে আবার চেষ্টা করুন।',
    });
  }

  return { reply, modelUsed: model };
}

export async function streamTutorChat(
  params: {
    message: string;
    history: Array<{ role: 'user' | 'assistant'; content: string }>;
    model?: string;
    temperature?: number;
  },
  apiKey: string,
  onChunk: (chunkText: string) => void
): Promise<{ fullText: string; modelUsed: string }> {
  const model = params.model?.trim() || getDefaultModel();
  const ai = createGenAIClient(apiKey);
  const config = applyTemperatureIfSupported(
    model,
    { systemInstruction: TUTOR_SYSTEM_INSTRUCTION },
    params.temperature
  );

  const chat = ai.chats.create({
    model,
    history: trimTutorHistory(params.history),
    config,
  });

  const stream = await withRateLimitBackoff(() =>
    chat.sendMessageStream({ message: params.message })
  );

  let fullText = '';
  for await (const chunk of stream) {
    assertNotSafetyBlocked(chunk);
    const piece = chunk.text ?? '';
    if (piece) {
      fullText += piece;
      onChunk(piece);
    }
  }

  if (!fullText.trim()) {
    throw new AiServiceError({
      statusCode: 502,
      code: 'INVALID_AI_OUTPUT',
      messageEn: 'The AI tutor stream completed with no text. Please try again.',
      messageBn: 'AI টিউটর থেকে কোনো টেক্সট পাওয়া যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।',
    });
  }

  return { fullText, modelUsed: model };
}

export async function createStudyPlan(
  params: {
    goal: string;
    language?: OutputLanguage;
    model?: string;
    temperature?: number;
  },
  apiKey: string
): Promise<StudyPlanResponse> {
  const model = params.model?.trim() || getDefaultModel();
  const langRule =
    params.language === 'bengali'
      ? 'Write the weekly plan in Bengali (বাংলা).'
      : params.language === 'english'
        ? 'Write the weekly plan in English.'
        : 'Match the language of the student goal (Bengali if Bengali is used, otherwise clear English with helpful Bengali encouragement if appropriate).';

  const prompt = `
Create a realistic, structured 7-day weekly study routine for this student goal:
"${params.goal}"

Language rule: ${langRule}
Include Saturday through Friday (or Day 1 to Day 7 / Monday to Sunday) with exactly 7 days, realistic daily durationMinutes (between 30 and 360), concrete focusSubject, specific topics, and actionable study activity + rest/revision balance.
`.trim();

  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      goalSummary: { type: Type.STRING },
      weeklyHours: { type: Type.NUMBER },
      days: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            day: { type: Type.STRING },
            focusSubject: { type: Type.STRING },
            topics: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            durationMinutes: { type: Type.INTEGER },
            activity: { type: Type.STRING },
          },
          required: ['day', 'focusSubject', 'topics', 'durationMinutes', 'activity'],
        },
      },
      tips: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
      },
    },
    required: ['title', 'goalSummary', 'weeklyHours', 'days', 'tips'],
  };

  const result = await generateStructuredJson({
    apiKey,
    model,
    contents: prompt,
    systemInstruction:
      'You are EduGenius AI Academic Planner. Build practical, balanced 7-day study routines for students.',
    responseSchema,
    zodSchema: StudyPlanAiOutputSchema,
    temperature: params.temperature,
  });

  return {
    ...result,
    modelUsed: model,
  };
}
