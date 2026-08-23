import { Router } from 'express';
import { GitHubController } from './github.controller';
import { authenticateUser } from '../../middleware/auth';
import express from 'express';

const router = Router();

// OAuth URLs need to know who the user is to generate state
router.get('/auth/url', authenticateUser, GitHubController.getAuthUrl);

// Callback from GitHub redirect doesn't have auth header, uses state param
router.get('/auth/callback', GitHubController.authCallback);

// Webhook receiver (called by GitHub, validated via HMAC)
// express.json's `verify` callback fires before parsing and receives the raw buffer.
// Attaching it to req.rawBody allows the controller to compute HMAC over the
// exact bytes GitHub signed, rather than re-serialising req.body (which changes
// whitespace/key-order and breaks real signatures).
router.post(
    '/webhooks',
    express.json({
        verify: (req: any, _res, buf) => {
            req.rawBody = buf;
        },
    }),
    GitHubController.webhookReceiver
);

export default router;
