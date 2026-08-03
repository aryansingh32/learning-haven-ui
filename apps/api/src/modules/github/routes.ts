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
// Needs raw body for HMAC verification if express.json() was globally applied
// Note: if the main app.ts already uses express.json() without preserving raw body, 
// the signature check might fail depending on payload whitespace.
// A common fix is using express.json({ verify: (req, buf) => req.rawBody = buf }) in app.ts
router.post('/webhooks', express.json(), GitHubController.webhookReceiver);

export default router;
