import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/database';
import logger from '../config/logger';
import jwt from 'jsonwebtoken';
import { verifySupabaseAccessToken } from '../utils/supabaseJwt';

export interface AuthRequest extends Request {
  user?: any;
}

export const authenticateUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split(' ')[1];

    // Try Supabase auth with timeout
    let user = null;
    let error = null;

    try {
      const authPromise = supabase.auth.getUser(token);
      const timeoutMs = Number(process.env.SUPABASE_AUTH_TIMEOUT_MS) || 12_000;
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Supabase Auth Timeout')), timeoutMs)
      );

      const result = (await Promise.race([authPromise, timeoutPromise])) as {
        data?: { user?: { id: string; email?: string } };
        error?: Error;
      };
      user = result.data?.user;
      error = result.error;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Auth error';
      logger.warn(`Supabase auth failed or timed out: ${message}`);
      error = err instanceof Error ? err : new Error(message);
    }

    if (!error && user) {
      req.user = user;
      return next();
    }

    // When Supabase Auth API is slow/unreachable, verify JWT locally (JWKS or legacy secret)
    const verified = verifySupabaseAccessToken(token);
    if (verified) {
      req.user = { id: verified.id, email: verified.email, role: verified.role };
      logger.debug('Authenticated via local Supabase JWT verification');
      return next();
    }

    // DEV ONLY: Fall back to local app JWT verification
    if (process.env.NODE_ENV === 'development') {
      try {
        const secret = process.env.JWT_SECRET || 'development-secret-key-change-in-prod-min-32-chars';
        const decoded = jwt.verify(token, secret) as { sub?: string; email?: string; role?: string };
        if (decoded?.sub) {
          req.user = { id: decoded.sub, email: decoded.email, role: decoded.role };
          logger.debug('Using local JWT fallback for auth');
          return next();
        }
      } catch {
        /* local JWT also failed */
      }
    }

    const errMsg = (error?.message || '').toLowerCase();
    const expired = errMsg.includes('expired');
    logger.warn(`Auth failed: ${error?.message || 'No user found'}`);
    return res.status(401).json({
      error: expired ? 'Token expired' : 'Unauthorized: Invalid token',
      code: expired ? 'TOKEN_EXPIRED' : 'AUTH_INVALID',
    });
  } catch (err) {
    logger.error('Auth middleware error', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * Optional authentication - doesn't fail if no token
 * Used for endpoints that work for both authenticated and anonymous users
 */
export const optionalAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      // No token provided, continue without user
      return next();
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      // Invalid token, continue without user
      // We might want to log this as debug
      return next();
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    // Error verifying token, continue without user
    next();
  }
};
