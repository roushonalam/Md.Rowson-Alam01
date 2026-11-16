import crypto from 'node:crypto';
import type { Request } from 'express';

interface AdminSession {
  username: string;
  expiresAt: number;
}

const ADMIN_SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
const DEFAULT_ADMIN_USERNAME = 'AR Arafat';
const DEFAULT_ADMIN_PASSWORD_HASH =
  'edugenius_admin_v1_salt:3de6b423dce97489694224a845370b67fba090bc26c5eb14605f0ba5ac56dc7a';

const adminSessions = new Map<string, AdminSession>();

let runtimeAdminApiKey: string | null = null;
let runtimeAdminDefaultModel: string | null = null;
let totalApiRequests = 0;
const serverStartedAt = Date.now();

const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [token, session] of adminSessions.entries()) {
    if (session.expiresAt <= now) {
      adminSessions.delete(token);
    }
  }
}, 15 * 60 * 1000);
cleanupTimer.unref();

export function incrementApiRequestCount(): void {
  totalApiRequests += 1;
}

export function getServerStats(): {
  totalApiRequests: number;
  uptimeSeconds: number;
} {
  return {
    totalApiRequests,
    uptimeSeconds: Math.floor((Date.now() - serverStartedAt) / 1000),
  };
}

function timingSafeEqualsText(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function verifyAdminCredentials(username: string, password: string): boolean {
  const configuredUsername =
    process.env.ADMIN_USERNAME?.trim() || DEFAULT_ADMIN_USERNAME;
  const normalizedInputUser = username.trim().toLowerCase();
  const normalizedTargetUser = configuredUsername.toLowerCase();

  if (!timingSafeEqualsText(normalizedInputUser, normalizedTargetUser)) {
    return false;
  }

  const configuredPassword = process.env.ADMIN_PASSWORD?.trim();
  if (configuredPassword) {
    return timingSafeEqualsText(password, configuredPassword);
  }

  const [salt, expectedHex] = DEFAULT_ADMIN_PASSWORD_HASH.split(':');
  if (!salt || !expectedHex) return false;
  const derivedHex = crypto.scryptSync(password, salt, 32).toString('hex');
  return timingSafeEqualsText(derivedHex, expectedHex);
}

export function createAdminSession(username: string): string {
  const token = crypto.randomUUID();
  adminSessions.set(token, {
    username: username.trim(),
    expiresAt: Date.now() + ADMIN_SESSION_TTL_MS,
  });
  return token;
}

export function getAdminTokenFromRequest(req: Request): string | undefined {
  const raw = req.header('x-admin-session');
  if (!raw || typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function getAuthenticatedAdmin(req: Request): AdminSession | null {
  const token = getAdminTokenFromRequest(req);
  if (!token) return null;
  const session = adminSessions.get(token);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    adminSessions.delete(token);
    return null;
  }
  session.expiresAt = Date.now() + ADMIN_SESSION_TTL_MS;
  return session;
}

export function revokeAdminSession(req: Request): void {
  const token = getAdminTokenFromRequest(req);
  if (token) {
    adminSessions.delete(token);
  }
}

export function setAdminRuntimeApiKey(apiKey: string): { maskedHint: string } {
  runtimeAdminApiKey = apiKey.trim();
  return {
    maskedHint: `••••${runtimeAdminApiKey.slice(-4)}`,
  };
}

export function clearAdminRuntimeApiKey(): void {
  runtimeAdminApiKey = null;
}

export function getAdminRuntimeApiKey(): string | null {
  return runtimeAdminApiKey;
}

export function getAdminRuntimeKeyMask(): string | null {
  if (!runtimeAdminApiKey) return null;
  return `••••${runtimeAdminApiKey.slice(-4)}`;
}

export function setAdminRuntimeDefaultModel(modelId: string | null): void {
  runtimeAdminDefaultModel = modelId ? modelId.trim() : null;
}

export function getAdminRuntimeDefaultModel(): string | null {
  return runtimeAdminDefaultModel;
}
