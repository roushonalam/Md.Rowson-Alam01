import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { apiRouter } from './server/routes/api.ts';
import {
  apiGeneralLimiter,
  corsErrorHandler,
  createCorsMiddleware,
  securityHeaders,
} from './server/middleware/security.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const isProd = process.env.NODE_ENV === 'production';
  const port = isProd ? Number(process.env.PORT) || 3000 : 3000;

  app.set('trust proxy', 1);
  app.use(securityHeaders);
  app.use(createCorsMiddleware());
  app.use(express.json({ limit: '64kb' }));
  app.use(corsErrorHandler);

  app.use('/api', apiGeneralLimiter, apiRouter);

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : undefined,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir, { index: false }));
    app.get('*', (_req: Request, res: Response, next: NextFunction) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (!fs.existsSync(indexHtml)) {
        next();
        return;
      }
      res.sendFile(indexHtml);
    });
  }

  app.use((_err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        messageEn: 'Unexpected server error.',
        messageBn: 'সার্ভারে একটি অপ্রত্যাশিত ত্রুটি হয়েছে।',
      },
    });
  });

  app.listen(port, '0.0.0.0', () => {
    console.log(`EduGenius AI server listening on http://localhost:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err instanceof Error ? err.message : 'Unknown error');
  process.exit(1);
});
