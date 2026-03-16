import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/database';
import logger from '../config/logger';
import jwt from 'jsonwebtoken';

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
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Supabase Auth Timeout')), 5000)
      );

      const result = await Promise.race([authPromise, timeoutPromise]) as any;
      user = result.data?.user;
      error = result.error;
    } catch (err: any) {
      logger.warn(`Supabase auth failed or timed out: ${err.message}`);
      error = err;
    }

    if (!error && user) {
      req.user = user;
      return next();
    }

    // DEV ONLY: Fall back to local JWT verification
    if (process.env.NODE_ENV === 'development') {
      try {
        const secret = process.env.JWT_SECRET || 'development-secret-key-change-in-prod-min-32-chars';
        const decoded = jwt.verify(token, secret) as any;
        if (decoded && decoded.sub) {
          req.user = { id: decoded.sub, email: decoded.email, role: decoded.role };
          logger.debug('Using local JWT fallback for auth');
          return next();
        }
      } catch (jwtErr) {
        // Local JWT also failed
      }
    }

    logger.warn(`Auth failed: ${error?.message || 'No user found'}`);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
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
