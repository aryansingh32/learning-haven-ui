import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/database';
import logger from '../config/logger';
import jwt from 'jsonwebtoken';
import { verifySupabaseAccessToken } from '../utils/supabaseJwt';
import { requestContext } from './requestTracer';
import { unauthorized, forbidden, serverError } from '../utils/api-response';

export interface AuthRequest extends Request {
  user?: any;
}

export const authenticateUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      return unauthorized(res, 'No token provided');
    }

    const token = authHeader.split(' ')[1];

    // ── Fast path: verify locally using JWKS / JWT secret (zero network latency).
    // Handles the vast majority of requests without any outbound network call.
    const localVerified = verifySupabaseAccessToken(token);
    if (localVerified) {
      req.user = { id: localVerified.id, email: localVerified.email, role: localVerified.role };
      logger.debug('Authenticated via local Supabase JWT verification');
      const ctx = requestContext.getStore();
      if (ctx) ctx.userId = localVerified.id;
      return next();
    }

    // DEV ONLY: Fall back to local app JWT verification
    if (process.env.NODE_ENV === 'development') {
      try {
        const secret = process.env.JWT_SECRET!; // Validated at startup by config/env.ts
        const decoded = jwt.verify(token, secret) as { sub?: string; email?: string; role?: string };
        if (decoded?.sub) {
          req.user = { id: decoded.sub, email: decoded.email, role: decoded.role };
          logger.debug('Using local JWT fallback for auth');
          const ctx = requestContext.getStore();
          if (ctx) ctx.userId = decoded.sub;
          return next();
        }
      } catch {
        /* local JWT also failed — fall through to remote */
      }
    }

    // ── Slow path: local verification failed (unknown key, possible key rotation).
    // Try remote Supabase as last resort, guarded by a timeout.
    let user = null;
    let remoteError: Error | null = null;

    try {
      const timeoutMs = Number(process.env.SUPABASE_AUTH_TIMEOUT_MS) || 12_000;
      const authPromise = supabase.auth.getUser(token);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Supabase Auth Timeout')), timeoutMs)
      );

      const result = (await Promise.race([authPromise, timeoutPromise])) as {
        data?: { user?: { id: string; email?: string } };
        error?: Error;
      };
      user = result.data?.user ?? null;
      remoteError = result.error ?? null;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Auth error';
      logger.warn(`Supabase remote auth failed or timed out: ${message}`);
      remoteError = err instanceof Error ? err : new Error(message);
    }

    if (!remoteError && user) {
      req.user = user;
      const ctx = requestContext.getStore();
      if (ctx) ctx.userId = (user as any).id;
      return next();
    }

    const errMsg = (remoteError?.message || '').toLowerCase();
    const expired = errMsg.includes('expired');
    logger.warn(`Auth failed: ${remoteError?.message || 'No user found'}`);
    return unauthorized(res, expired ? 'Token expired' : 'Invalid token');
  } catch (err) {
    logger.error('Auth middleware error', err);
    return serverError(res);
  }
};

/**
 * Optional authentication - doesn't fail if no token.
 * Used for endpoints that work for both authenticated and anonymous users.
 */
export const optionalAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];

    // Fast path: local JWT verification (no network call)
    const localVerified = verifySupabaseAccessToken(token);
    if (localVerified) {
      req.user = { id: localVerified.id, email: localVerified.email, role: localVerified.role };
      const ctx = requestContext.getStore();
      if (ctx) ctx.userId = localVerified.id;
      return next();
    }

    // Slow path: remote Supabase auth with timeout guard
    try {
      const timeoutMs = Number(process.env.SUPABASE_AUTH_TIMEOUT_MS) || 12_000;
      const authPromise = supabase.auth.getUser(token);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Supabase Auth Timeout')), timeoutMs)
      );

      const result = (await Promise.race([authPromise, timeoutPromise])) as {
        data?: { user?: { id: string; email?: string } };
        error?: Error;
      };
      const user = result.data?.user;

      if (user && !result.error) {
        req.user = user;
        const ctx = requestContext.getStore();
        if (ctx) ctx.userId = (user as any).id;
      }
    } catch {
      // Timed out or network error — continue as anonymous, don't block the request
    }

    return next();
  } catch {
    // Unexpected error — continue without user
    next();
  }
};

export const requireRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return forbidden(res, 'Insufficient permissions');
    }
    next();
  };
};
