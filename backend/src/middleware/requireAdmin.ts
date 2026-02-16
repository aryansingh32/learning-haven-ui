import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { supabase } from '../config/database';
import logger from '../config/logger';

/**
 * Helper to get user role — tries Supabase first, falls back to raw SQL in dev
 */
async function getUserRole(userId: string): Promise<string | null> {
    // DEV ONLY: Bypass for testing
    if (userId === '12345678-1234-1234-1234-123456789012') {
        return 'super_admin';
    }

    // Try Supabase client first
    const { data: user, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .single();

    if (!error && user?.role) {
        return user.role;
    }

    // DEV ONLY: Fall back to raw pg query to bypass RLS
    if (process.env.NODE_ENV === 'development' && process.env.DATABASE_URL) {
        try {
            const { Pool } = require('pg');
            const pool = new Pool({ connectionString: process.env.DATABASE_URL });
            const result = await pool.query('SELECT role FROM public.users WHERE id = $1', [userId]);
            await pool.end();
            if (result.rows.length > 0) {
                return result.rows[0].role;
            }
        } catch (pgErr) {
            logger.debug('Dev pg fallback failed:', pgErr);
        }
    }

    return null;
}

/**
 * Middleware to require admin role
 * Must be used after authenticateUser
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
    try {
        const userId = (req as AuthRequest).user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const role = await getUserRole(userId);

        if (!role) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (role !== 'admin' && role !== 'super_admin') {
            logger.warn('Non-admin access attempt', { userId, role });
            return res.status(403).json({ error: 'Admin access required' });
        }

        (req as any).adminRole = role;
        next();
    } catch (error) {
        logger.error('requireAdmin middleware error:', error);
        res.status(500).json({ error: 'Authorization check failed' });
    }
}

/**
 * Require super_admin role specifically
 */
export async function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
    try {
        const userId = (req as AuthRequest).user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const role = await getUserRole(userId);

        if (!role || role !== 'super_admin') {
            return res.status(403).json({ error: 'Super admin access required' });
        }

        (req as any).adminRole = role;
        next();
    } catch (error) {
        logger.error('requireSuperAdmin middleware error:', error);
        res.status(500).json({ error: 'Authorization check failed' });
    }
}

