import crypto from 'node:crypto';
import type { Request } from 'express';
import { getAdminRuntimeApiKey } from './adminAuth.ts';

interface SessionKeyEntry {
  apiKey: string;
  expiresAt: number;
}

const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours in server RAM only
const sessionStore = new Map<string, SessionKeyEntry>();

// Periodically purge expired in-memory session keys
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of sessionStore.entries()) {
    if (entry.expiresAt <= now) {
      sessionStore.delete(token);
    }
  }
}, 15 * 60 * 1000);
cleanupTimer.unref();

export function createSessionKey(apiKey: string): {
  sessionToken: string;
  maskedHint: string;
} {
  const token = crypto.randomUUID();
  sessionStore.set(token, {
    apiKey,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
  const tail = apiKey.slice(-4);
  return {
    sessionToken: token,
    maskedHint: `••••${tail}`,
  };
}

export function deleteSessionKey(sessionToken: string | undefined): boolean {
  if (!sessionToken) return false;
  return sessionStore.delete(sessionToken);
}

export function getSessionTokenFromRequest(req: Request): string | undefined {
  const raw = req.header('x-edugenius-session');
  if (!raw || typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function hasActiveSessionKey(req: Request): boolean {
  const token = getSessionTokenFromRequest(req);
  if (!token) return false;
  const entry = sessionStore.get(token);
  if (!entry) return false;
  if (entry.expiresAt <= Date.now()) {
    sessionStore.delete(token);
    return false;
  }
  entry.expiresAt = Date.now() + SESSION_TTL_MS;
  return true;
}

export function resolveApiKeyForRequest(req: Request): {
  apiKey: string | undefined;
  source: 'session' | 'admin' | 'env' | 'none';
} {
  const token = getSessionTokenFromRequest(req);
  if (token) {
    const entry = sessionStore.get(token);
    if (entry) {
      if (entry.expiresAt > Date.now()) {
        entry.expiresAt = Date.now() + SESSION_TTL_MS;
        return { apiKey: entry.apiKey, source: 'session' };
      }
      sessionStore.delete(token);
    }
  }

  const adminKey = getAdminRuntimeApiKey();
  if (adminKey) {
    return { apiKey: adminKey, source: 'admin' };
  }

  const envKey = process.env.GEMINI_API_KEY?.trim();
  if (envKey && envKey !== 'MY_GEMINI_API_KEY') {
    return { apiKey: envKey, source: 'env' };
  }

  return { apiKey: undefined, source: 'none' };
}
