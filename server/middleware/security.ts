import cors from 'cors';
import type { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import type { ApiErrorPayload } from '../../shared/types.ts';

export function buildAllowedOrigins(): Set<string> {
  const origins = new Set<string>([
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ]);

  const appUrl = process.env.APP_URL?.trim();
  if (appUrl && appUrl !== 'MY_APP_URL') {
    try {
      origins.add(new URL(appUrl).origin);
    } catch {
      // Ignore malformed APP_URL
    }
  }

  const rawAllowed = process.env.ALLOWED_ORIGINS?.trim();
  if (rawAllowed) {
    for (const part of rawAllowed.split(',')) {
      const cleaned = part.trim();
      if (!cleaned) continue;
      try {
        origins.add(new URL(cleaned).origin);
      } catch {
        origins.add(cleaned);
      }
    }
  }

  return origins;
}

export const securityHeaders = helmet({
  // Allow embedding inside AI Studio preview iframe
  frameguard: false,
  // Configured cleanly so Vite module scripts, Google Fonts, and KaTeX inline/font styles work
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'", 'ws:', 'wss:', 'https:'],
      frameAncestors: ["'self'", 'https://aistudio.google.com', 'https://*.google.com', 'https://*.googleusercontent.com'],
    },
  },
  crossOriginEmbedderPolicy: false,
});

export function createCorsMiddleware() {
  const allowedOrigins = buildAllowedOrigins();

  return cors({
    origin(origin, callback) {
      // Allow same-origin / server-to-server / curl requests without Origin header
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      // Allow Cloud Run AI Studio preview origins for the hosted applet
      try {
        const hostname = new URL(origin).hostname;
        if (
          hostname.endsWith('.run.app') ||
          hostname === 'localhost' ||
          hostname === '127.0.0.1'
        ) {
          callback(null, true);
          return;
        }
      } catch {
        // Fall through to reject
      }

      callback(new Error('Origin not allowed by CORS policy'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-EduGenius-Session', 'X-Admin-Session'],
  });
}

export const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      messageEn: 'Too many admin login attempts. Please wait 15 minutes and try again.',
      messageBn: 'অতিরিক্ত অ্যাডমিন লগইন চেষ্টা করা হয়েছে। অনুগ্রহ করে ১৫ মিনিট পর আবার চেষ্টা করুন।',
      retryAfterSeconds: 60,
    },
  } satisfies ApiErrorPayload,
});

export const apiGeneralLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      messageEn: 'Too many requests. Please wait a moment and try again.',
      messageBn: 'অতিরিক্ত অনুরোধ পাঠানো হয়েছে। অনুগ্রহ করে কিছুক্ষণ অপেক্ষা করে আবার চেষ্টা করুন।',
      retryAfterSeconds: 30,
    },
  } satisfies ApiErrorPayload,
});

export const aiGenerationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      messageEn: 'AI request limit reached for this minute. Please try again in 30 seconds.',
      messageBn: 'এই মিনিটের AI অনুরোধের সীমা পূর্ণ হয়েছে। অনুগ্রহ করে ৩০ সেকেন্ড পর আবার চেষ্টা করুন।',
      retryAfterSeconds: 30,
    },
  } satisfies ApiErrorPayload,
});

export function corsErrorHandler(
  err: Error,
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  if (err && err.message === 'Origin not allowed by CORS policy') {
    const payload: ApiErrorPayload = {
      error: {
        code: 'VALIDATION_ERROR',
        messageEn: 'Cross-origin request blocked by server CORS policy.',
        messageBn: 'সার্ভারের CORS নীতির কারণে এই অনুরোধটি ব্লক করা হয়েছে।',
      },
    };
    res.status(403).json(payload);
    return;
  }
  next(err);
}
