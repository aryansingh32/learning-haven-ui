import express from 'express';
import cors from 'cors';
import './workers/email.worker';
import './workers/verification.worker';
import './workers/build-verification.worker';
import helmet from 'helmet';
import compression from 'compression';
import { authenticateUser } from './middleware/auth';
import logger from './config/logger';
import { requestTracer, requestContext } from './middleware/requestTracer';
import { env } from './config/env';
import { metricsMiddleware, renderPrometheusMetrics } from './observability/metrics';

import routes from './modules/core/routes/index';

const app = express();

// Trust reverse proxy (like ngrok, nginx) to get correct client IP
app.set('trust proxy', 1);

// ──────────────────────────────────────────────────────────
// Security & parsing
// ──────────────────────────────────────────────────────────
// ── CORS: only allow known origins ──────────────────────────
const ALLOWED_ORIGINS = [
  'https://learninghaven.in',
  'https://www.learninghaven.in',
  'https://admin.learninghaven.in',
  'https://app.learninghaven.in',
  // Add any other production origins here
];

if (env.NODE_ENV !== 'production') {
  ALLOWED_ORIGINS.push(
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
  );
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (server-to-server, Postman, curl)
      if (!origin) return callback(null, true);
      // In development, allow all origins (including ngrok tunnels)
      if (env.NODE_ENV !== 'production') return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Request-ID', 'ngrok-skip-browser-warning'],
  })
);
app.use(helmet());
app.use(compression());

// Payload size limits — prevent abuse
app.use(
  express.json({
    limit: '1mb',
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ──────────────────────────────────────────────────────────
// Request tracing & logging
// ──────────────────────────────────────────────────────────
app.use(requestTracer);
app.use(metricsMiddleware);

app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        const moduleMatch = req.originalUrl.match(/^\/api\/([^\/?]+)/);
        const module = moduleMatch ? moduleMatch[1] : 'core';
        
        const userId = (req as any).user?.id || requestContext.getStore()?.userId;
        
        logger.info('HTTP Request', {
            action: `${req.method} ${req.originalUrl}`,
            module,
            duration,
            status: res.statusCode,
            userId,
        });
    });
    next();
});

// ──────────────────────────────────────────────────────────
// Routes
// ──────────────────────────────────────────────────────────
app.use('/api', routes);

app.get('/', (req, res) => {
    const { code, state } = req.query;
    if (
        typeof code === 'string' &&
        typeof state === 'string' &&
        code.length > 0 &&
        state.length > 0
    ) {
        const qs = new URLSearchParams({ code, state });
        return res.redirect(302, `/api/v1/apprenticeship/auth/github/callback?${qs.toString()}`);
    }
    res.send('Learning Haven API v2.0 is running');
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/metrics', (req, res) => {
    if (env.METRICS_SECRET_TOKEN) {
        const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
        if (token !== env.METRICS_SECRET_TOKEN) {
            return res.status(401).json({
                success: false,
                error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
            });
        }
    }

    res.setHeader('Content-Type', 'text/plain; version=0.0.4');
    res.send(renderPrometheusMetrics());
});

// Protected Route Example
app.get('/api/protected', authenticateUser, (req, res) => {
    res.json({ message: 'You are authenticated', user: (req as any).user });
});

// ──────────────────────────────────────────────────────────
// Global error handler
// Never leak stack traces or internal error details to clients.
// ──────────────────────────────────────────────────────────
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error({
        message: err.message,
        stack: process.env.NODE_ENV === 'production' ? '[REDACTED]' : err.stack,
        requestId: req.headers['x-request-id'],
        path: req.path,
        method: req.method,
    });

    return res.status(500).json({
        success: false,
        error: {
            code: 'INTERNAL_SERVER_ERROR',
            message:
                process.env.NODE_ENV === 'production'
                    ? 'An unexpected error occurred'
                    : err.message,
        },
    });
});

export default app;
