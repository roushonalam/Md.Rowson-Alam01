import { Router, type NextFunction, type Request, type Response } from 'express';
import { ZodError } from 'zod';
import {
  AdminApiKeyRequestSchema,
  AdminDefaultModelSchema,
  AdminLoginRequestSchema,
  ExplainRequestSchema,
  QuizCheckRequestSchema,
  QuizGenerateRequestSchema,
  SessionKeyRequestSchema,
  StudyPlanRequestSchema,
  TestConnectionRequestSchema,
  TutorChatRequestSchema,
} from '../schemas/aiSchemas.ts';
import {
  AiServiceError,
  checkQuizAnswer,
  createStudyPlan,
  explainTopic,
  generateQuiz,
  getActiveQuizSessionCount,
  getDefaultModel,
  listAvailableModels,
  mapUnknownErrorToAiError,
  streamTutorChat,
  testConnection,
  tutorChat,
} from '../services/ai/index.ts';
import {
  clearAdminRuntimeApiKey,
  createAdminSession,
  getAdminRuntimeApiKey,
  getAdminRuntimeKeyMask,
  getAuthenticatedAdmin,
  getServerStats,
  incrementApiRequestCount,
  revokeAdminSession,
  setAdminRuntimeApiKey,
  setAdminRuntimeDefaultModel,
  verifyAdminCredentials,
} from '../services/adminAuth.ts';
import {
  createSessionKey,
  deleteSessionKey,
  getSessionTokenFromRequest,
  hasActiveSessionKey,
  resolveApiKeyForRequest,
} from '../services/sessionKeys.ts';
import { adminLoginLimiter, aiGenerationLimiter } from '../middleware/security.ts';
import type {
  AdminLoginResponse,
  AdminStatusResponse,
  ApiErrorPayload,
  HealthResponse,
  ModelsResponse,
} from '../../shared/types.ts';

export const apiRouter = Router();

apiRouter.use((_req: Request, _res: Response, next: NextFunction) => {
  incrementApiRequestCount();
  next();
});

function requireApiKey(req: Request): string {
  const { apiKey } = resolveApiKeyForRequest(req);
  if (!apiKey) {
    throw new AiServiceError({
      statusCode: 503,
      code: 'MISSING_API_KEY',
      messageEn:
        'Gemini API key is not configured on the server. Set GEMINI_API_KEY or configure it in the Admin Portal (/admin).',
      messageBn:
        'সার্ভারে Gemini API কী কনফিগার করা নেই। GEMINI_API_KEY সেট করুন অথবা Admin পোর্টাল (/admin) থেকে কী যুক্ত করুন।',
    });
  }
  return apiKey;
}

function requireAdmin(req: Request): { username: string } {
  const session = getAuthenticatedAdmin(req);
  if (!session) {
    throw new AiServiceError({
      statusCode: 401,
      code: 'UNAUTHORIZED',
      messageEn: 'Admin authentication required. Please sign in.',
      messageBn: 'অ্যাডমিন অনুমোদন প্রয়োজন। অনুগ্রহ করে লগইন করুন।',
    });
  }
  return session;
}

function sendErrorResponse(res: Response, err: unknown): void {
  if (err instanceof ZodError) {
    const first = err.issues[0];
    const messageEn = first ? `${first.path.join('.') || 'input'}: ${first.message}` : 'Invalid request data.';
    const payload: ApiErrorPayload = {
      error: {
        code: 'VALIDATION_ERROR',
        messageEn,
        messageBn: 'অনুরোধের তথ্য সঠিক নয়। অনুগ্রহ করে সব ঘর সঠিকভাবে পূরণ করুন।',
      },
    };
    res.status(400).json(payload);
    return;
  }

  const mapped = mapUnknownErrorToAiError(err);
  if (mapped.retryAfterSeconds) {
    res.setHeader('Retry-After', String(mapped.retryAfterSeconds));
  }
  res.status(mapped.statusCode).json(mapped.toPayload());
}

apiRouter.get('/health', (req: Request, res: Response) => {
  const envKey = process.env.GEMINI_API_KEY?.trim();
  const hasEnvKey = Boolean(envKey && envKey !== 'MY_GEMINI_API_KEY');
  const hasAdminKey = Boolean(getAdminRuntimeApiKey());
  const hasSessionKey = hasActiveSessionKey(req);
  const status = hasEnvKey || hasAdminKey || hasSessionKey ? 'connected' : 'not_configured';

  const body: HealthResponse = {
    status,
    hasEnvKey,
    hasAdminKey,
    hasSessionKey,
    defaultModel: getDefaultModel(),
    timestamp: new Date().toISOString(),
  };

  res.json(body);
});

// Admin authentication & runtime configuration endpoints
apiRouter.post('/admin/login', adminLoginLimiter, (req: Request, res: Response) => {
  try {
    const parsed = AdminLoginRequestSchema.parse(req.body);
    if (!verifyAdminCredentials(parsed.username, parsed.password)) {
      throw new AiServiceError({
        statusCode: 401,
        code: 'UNAUTHORIZED',
        messageEn: 'Invalid admin username or password.',
        messageBn: 'অ্যাডমিন ইউজারনেম বা পাসওয়ার্ড সঠিক নয়।',
      });
    }

    const adminToken = createAdminSession(parsed.username);
    const body: AdminLoginResponse = {
      adminToken,
      username: parsed.username.trim(),
    };
    res.json(body);
  } catch (err) {
    sendErrorResponse(res, err);
  }
});

apiRouter.post('/admin/logout', (req: Request, res: Response) => {
  revokeAdminSession(req);
  res.json({ loggedOut: true });
});

apiRouter.get('/admin/status', (req: Request, res: Response) => {
  try {
    const admin = requireAdmin(req);
    const envKey = process.env.GEMINI_API_KEY?.trim();
    const hasEnvKey = Boolean(envKey && envKey !== 'MY_GEMINI_API_KEY');
    const hasAdminKey = Boolean(getAdminRuntimeApiKey());
    const stats = getServerStats();

    const activeKeySource: AdminStatusResponse['activeKeySource'] = hasAdminKey
      ? 'admin'
      : hasEnvKey
        ? 'env'
        : 'none';

    const body: AdminStatusResponse = {
      authenticated: true,
      username: admin.username,
      connectionStatus: hasEnvKey || hasAdminKey ? 'connected' : 'not_configured',
      activeKeySource,
      hasEnvKey,
      hasAdminKey,
      adminKeyMask: getAdminRuntimeKeyMask(),
      defaultModel: getDefaultModel(),
      activeQuizSessions: getActiveQuizSessionCount(),
      totalApiRequests: stats.totalApiRequests,
      uptimeSeconds: stats.uptimeSeconds,
    };
    res.json(body);
  } catch (err) {
    sendErrorResponse(res, err);
  }
});

apiRouter.post('/admin/api-key', async (req: Request, res: Response) => {
  try {
    requireAdmin(req);
    const parsed = AdminApiKeyRequestSchema.parse(req.body);

    let verification: { ok: boolean; model: string; latencyMs: number; sampleReply: string } | null = null;
    if (!parsed.skipVerify) {
      verification = await testConnection(parsed.apiKey, getDefaultModel());
    }

    const { maskedHint } = setAdminRuntimeApiKey(parsed.apiKey);
    res.json({
      saved: true,
      maskedHint,
      verified: Boolean(verification?.ok),
      latencyMs: verification?.latencyMs,
    });
  } catch (err) {
    sendErrorResponse(res, err);
  }
});

apiRouter.delete('/admin/api-key', (req: Request, res: Response) => {
  try {
    requireAdmin(req);
    clearAdminRuntimeApiKey();
    res.json({ cleared: true });
  } catch (err) {
    sendErrorResponse(res, err);
  }
});

apiRouter.post('/admin/default-model', (req: Request, res: Response) => {
  try {
    requireAdmin(req);
    const parsed = AdminDefaultModelSchema.parse(req.body);
    setAdminRuntimeDefaultModel(parsed.model);
    res.json({ defaultModel: getDefaultModel() });
  } catch (err) {
    sendErrorResponse(res, err);
  }
});

apiRouter.post('/session-key', (req: Request, res: Response) => {
  try {
    const parsed = SessionKeyRequestSchema.parse(req.body);
    const { sessionToken, maskedHint } = createSessionKey(parsed.apiKey);
    res.status(201).json({
      sessionToken,
      maskedHint,
      hasSessionKey: true,
    });
  } catch (err) {
    sendErrorResponse(res, err);
  }
});

apiRouter.delete('/session-key', (req: Request, res: Response) => {
  const token = getSessionTokenFromRequest(req);
  deleteSessionKey(token);
  res.json({ cleared: true });
});

apiRouter.get('/models', async (req: Request, res: Response) => {
  try {
    const { apiKey } = resolveApiKeyForRequest(req);
    const defaultModel = getDefaultModel();

    if (!apiKey) {
      const payload: ModelsResponse = {
        configured: false,
        defaultModel,
        models: [],
        messageEn: 'API key not configured. Connect a key to load live Gemini models.',
        messageBn: 'API কী কনফিগার করা নেই। লাইভ Gemini মডেল তালিকা দেখতে কী সংযুক্ত করুন।',
      };
      res.json(payload);
      return;
    }

    const models = await listAvailableModels(apiKey);
    const payload: ModelsResponse = {
      configured: true,
      defaultModel,
      models,
    };
    res.json(payload);
  } catch (err) {
    sendErrorResponse(res, err);
  }
});

apiRouter.post('/test-connection', aiGenerationLimiter, async (req: Request, res: Response) => {
  try {
    const apiKey = requireApiKey(req);
    const parsed = TestConnectionRequestSchema.parse(req.body ?? {});
    const result = await testConnection(apiKey, parsed.model);
    res.json(result);
  } catch (err) {
    sendErrorResponse(res, err);
  }
});

apiRouter.post('/explain', aiGenerationLimiter, async (req: Request, res: Response) => {
  try {
    const apiKey = requireApiKey(req);
    const parsed = ExplainRequestSchema.parse(req.body);
    const result = await explainTopic(parsed, apiKey);
    res.json(result);
  } catch (err) {
    sendErrorResponse(res, err);
  }
});

apiRouter.post('/quiz/generate', aiGenerationLimiter, async (req: Request, res: Response) => {
  try {
    const apiKey = requireApiKey(req);
    const parsed = QuizGenerateRequestSchema.parse(req.body);
    const quiz = await generateQuiz(parsed, apiKey);
    res.json(quiz);
  } catch (err) {
    sendErrorResponse(res, err);
  }
});

apiRouter.post('/quiz/check', (req: Request, res: Response) => {
  try {
    const parsed = QuizCheckRequestSchema.parse(req.body);
    const result = checkQuizAnswer(parsed);
    res.json(result);
  } catch (err) {
    sendErrorResponse(res, err);
  }
});

apiRouter.post('/tutor/chat', aiGenerationLimiter, async (req: Request, res: Response) => {
  let parsed;
  let apiKey: string;

  try {
    apiKey = requireApiKey(req);
    parsed = TutorChatRequestSchema.parse(req.body);
  } catch (err) {
    sendErrorResponse(res, err);
    return;
  }

  if (!parsed.stream) {
    try {
      const result = await tutorChat(parsed, apiKey);
      res.json(result);
    } catch (err) {
      sendErrorResponse(res, err);
    }
    return;
  }

  // SSE streaming mode
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  try {
    const { modelUsed } = await streamTutorChat(parsed, apiKey, (chunk) => {
      res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunk })}\n\n`);
    });
    res.write(`data: ${JSON.stringify({ type: 'done', modelUsed })}\n\n`);
    res.end();
  } catch (err) {
    const mapped = mapUnknownErrorToAiError(err);
    res.write(`data: ${JSON.stringify({ type: 'error', ...mapped.toPayload() })}\n\n`);
    res.end();
  }
});

apiRouter.post('/study-plan', aiGenerationLimiter, async (req: Request, res: Response) => {
  try {
    const apiKey = requireApiKey(req);
    const parsed = StudyPlanRequestSchema.parse(req.body);
    const plan = await createStudyPlan(parsed, apiKey);
    res.json(plan);
  } catch (err) {
    sendErrorResponse(res, err);
  }
});

apiRouter.use((_req: Request, res: Response) => {
  const payload: ApiErrorPayload = {
    error: {
      code: 'VALIDATION_ERROR',
      messageEn: 'API endpoint not found.',
      messageBn: 'API এন্ডপয়েন্ট পাওয়া যায়নি।',
    },
  };
  res.status(404).json(payload);
});

apiRouter.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  sendErrorResponse(res, err);
});
