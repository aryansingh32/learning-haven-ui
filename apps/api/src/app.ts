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
app.use(cors());
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
