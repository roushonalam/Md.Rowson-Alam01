import type {
  AdminLoginResponse,
  AdminStatusResponse,
  ApiErrorPayload,
  HealthResponse,
  ModelsResponse,
  OutputLanguage,
  QuizCheckRequest,
  QuizCheckResponse,
  QuizDifficulty,
  QuizGenerateResponse,
  StudyExplanationResponse,
  StudyLevel,
  StudyPlanResponse,
  StudyStyle,
  StudySubject,
  TestConnectionResponse,
} from '../types/index.ts';

export class ClientApiError extends Error {
  public readonly code: ApiErrorPayload['error']['code'];
  public readonly messageEn: string;
  public readonly messageBn: string;
  public readonly retryAfterSeconds?: number;
  public readonly status: number;

  constructor(
    status: number,
    payload: ApiErrorPayload['error']
  ) {
    super(payload.messageEn);
    this.name = 'ClientApiError';
    this.status = status;
    this.code = payload.code;
    this.messageEn = payload.messageEn;
    this.messageBn = payload.messageBn;
    this.retryAfterSeconds = payload.retryAfterSeconds;
  }
}

let activeSessionToken: string | null = null;
let activeAdminToken: string | null = null;

export function setInMemorySessionToken(token: string | null): void {
  activeSessionToken = token;
}

export function getInMemorySessionToken(): string | null {
  return activeSessionToken;
}

export function setInMemoryAdminToken(token: string | null): void {
  activeAdminToken = token;
}

export function getInMemoryAdminToken(): string | null {
  return activeAdminToken;
}

function buildHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extra,
  };
  if (activeSessionToken) {
    headers['X-EduGenius-Session'] = activeSessionToken;
  }
  if (activeAdminToken) {
    headers['X-Admin-Session'] = activeAdminToken;
  }
  return headers;
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: buildHeaders(init?.headers as Record<string, string> | undefined),
    });
  } catch {
    throw new ClientApiError(0, {
      code: 'NETWORK_ERROR',
      messageEn: 'Cannot reach the EduGenius server. Check your connection and try again.',
      messageBn: 'EduGenius সার্ভারের সাথে সংযোগ স্থাপন করা যায়নি। ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।',
    });
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    if (!response.ok) {
      throw new ClientApiError(response.status, {
        code: 'INTERNAL_ERROR',
        messageEn: `Server returned status ${response.status}.`,
        messageBn: `সার্ভার থেকে ত্রুটি (${response.status}) পাওয়া গেছে।`,
      });
    }
    throw new ClientApiError(500, {
      code: 'INTERNAL_ERROR',
      messageEn: 'Unexpected non-JSON response from server.',
      messageBn: 'সার্ভার থেকে অপ্রত্যাশিত তথ্য পাওয়া গেছে।',
    });
  }

  if (!response.ok) {
    const errObj = (data as Partial<ApiErrorPayload>)?.error;
    if (errObj && errObj.messageEn) {
      throw new ClientApiError(response.status, errObj);
    }
    throw new ClientApiError(response.status, {
      code: 'INTERNAL_ERROR',
      messageEn: 'Request failed. Please try again.',
      messageBn: 'অনুরোধটি সফল হয়নি। অনুগ্রহ করে আবার চেষ্টা করুন।',
    });
  }

  return data as T;
}

export function fetchHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>('/api/health', { method: 'GET' });
}

export function fetchModels(): Promise<ModelsResponse> {
  return apiFetch<ModelsResponse>('/api/models', { method: 'GET' });
}

export function testApiConnection(model?: string): Promise<TestConnectionResponse> {
  return apiFetch<TestConnectionResponse>('/api/test-connection', {
    method: 'POST',
    body: JSON.stringify(model ? { model } : {}),
  });
}

export async function registerSessionApiKey(
  apiKey: string
): Promise<{ sessionToken: string; maskedHint: string; hasSessionKey: boolean }> {
  const res = await apiFetch<{
    sessionToken: string;
    maskedHint: string;
    hasSessionKey: boolean;
  }>('/api/session-key', {
    method: 'POST',
    body: JSON.stringify({ apiKey }),
  });
  setInMemorySessionToken(res.sessionToken);
  return res;
}

export async function clearSessionApiKey(): Promise<void> {
  try {
    await apiFetch<{ cleared: boolean }>('/api/session-key', {
      method: 'DELETE',
    });
  } finally {
    setInMemorySessionToken(null);
  }
}

export async function adminLogin(
  username: string,
  password: string
): Promise<AdminLoginResponse> {
  const res = await apiFetch<AdminLoginResponse>('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  setInMemoryAdminToken(res.adminToken);
  return res;
}

export async function adminLogout(): Promise<void> {
  try {
    await apiFetch<{ loggedOut: boolean }>('/api/admin/logout', {
      method: 'POST',
    });
  } finally {
    setInMemoryAdminToken(null);
  }
}

export function fetchAdminStatus(): Promise<AdminStatusResponse> {
  return apiFetch<AdminStatusResponse>('/api/admin/status', {
    method: 'GET',
  });
}

export function setAdminRuntimeApiKey(
  apiKey: string,
  skipVerify = false
): Promise<{ saved: boolean; maskedHint: string; verified: boolean; latencyMs?: number }> {
  return apiFetch('/api/admin/api-key', {
    method: 'POST',
    body: JSON.stringify({ apiKey, skipVerify }),
  });
}

export function clearAdminRuntimeApiKey(): Promise<{ cleared: boolean }> {
  return apiFetch('/api/admin/api-key', {
    method: 'DELETE',
  });
}

export function setAdminDefaultModel(
  model: string
): Promise<{ defaultModel: string }> {
  return apiFetch('/api/admin/default-model', {
    method: 'POST',
    body: JSON.stringify({ model }),
  });
}

export function requestExplanation(payload: {
  subject: StudySubject;
  level: StudyLevel;
  style: StudyStyle;
  language: OutputLanguage;
  topic: string;
  model?: string;
  temperature?: number;
}): Promise<StudyExplanationResponse> {
  return apiFetch<StudyExplanationResponse>('/api/explain', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function requestQuizGeneration(payload: {
  subject: StudySubject;
  topic: string;
  difficulty: QuizDifficulty;
  count: 5 | 10;
  model?: string;
  temperature?: number;
}): Promise<QuizGenerateResponse> {
  return apiFetch<QuizGenerateResponse>('/api/quiz/generate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function requestQuizCheck(payload: QuizCheckRequest): Promise<QuizCheckResponse> {
  return apiFetch<QuizCheckResponse>('/api/quiz/check', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function requestStudyPlan(payload: {
  goal: string;
  language?: OutputLanguage;
  model?: string;
  temperature?: number;
}): Promise<StudyPlanResponse> {
  return apiFetch<StudyPlanResponse>('/api/study-plan', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function streamTutorChat(
  payload: {
    message: string;
    history: Array<{ role: 'user' | 'assistant'; content: string }>;
    model?: string;
    temperature?: number;
  },
  callbacks: {
    onChunk: (text: string) => void;
    onDone: (modelUsed: string) => void;
  },
  signal?: AbortSignal
): Promise<void> {
  let response: Response;
  try {
    response = await fetch('/api/tutor/chat', {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({ ...payload, stream: true }),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err;
    }
    throw new ClientApiError(0, {
      code: 'NETWORK_ERROR',
      messageEn: 'Network error while connecting to AI Tutor.',
      messageBn: 'AI টিউটরের সাথে সংযোগ করার সময় নেটওয়ার্ক ত্রুটি হয়েছে।',
    });
  }

  const contentType = response.headers.get('content-type') || '';
  if (!response.ok || contentType.includes('application/json')) {
    const json = (await response.json().catch(() => null)) as Partial<ApiErrorPayload> | null;
    if (json?.error) {
      throw new ClientApiError(response.status, json.error);
    }
    throw new ClientApiError(response.status, {
      code: 'INTERNAL_ERROR',
      messageEn: 'Tutor request failed.',
      messageBn: 'টিউটর অনুরোধটি ব্যর্থ হয়েছে।',
    });
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new ClientApiError(500, {
      code: 'INTERNAL_ERROR',
      messageEn: 'Streaming is unavailable in this browser.',
      messageBn: 'এই ব্রাউজারে স্ট্রিমিং সমর্থিত নয়।',
    });
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let receivedDone = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith('data:')) continue;
      const jsonStr = line.slice(5).trim();
      if (!jsonStr) continue;

      let event: {
        type: 'chunk' | 'done' | 'error';
        text?: string;
        modelUsed?: string;
        error?: ApiErrorPayload['error'];
      };
      try {
        event = JSON.parse(jsonStr);
      } catch {
        continue;
      }

      if (event.type === 'chunk' && event.text) {
        callbacks.onChunk(event.text);
      } else if (event.type === 'error' && event.error) {
        throw new ClientApiError(500, event.error);
      } else if (event.type === 'done') {
        receivedDone = true;
        callbacks.onDone(event.modelUsed ?? '');
      }
    }
  }

  if (!receivedDone) {
    callbacks.onDone('');
  }
}
