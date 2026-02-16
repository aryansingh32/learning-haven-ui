import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { supabase } from '../config/database';
import logger from '../config/logger';

/**
 * Middleware to capture and log admin mutations to admin_logs table.
 * Hooks into res.send to only log successful operations.
 */
export const adminLogging = async (req: Request, res: Response, next: NextFunction) => {
    // Only log mutations (POST, PUT, DELETE, PATCH)
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        const originalSend = res.send;

        // Wrap res.send to capture the response status
        res.send = function (body) {
            const adminId = (req as AuthRequest).user?.id;
            const action = `${req.method} ${req.originalUrl}`;

            // Extract resource details from URL: /api/admin/problems/:id -> problems, :id
            const pathParts = req.originalUrl.split('?')[0].split('/');
            const resourceType = pathParts[3] || 'unknown';
            const resourceId = req.params.id || pathParts[4] || null;

            // Only log successful operations (2xx statuses)
            if (adminId && res.statusCode >= 200 && res.statusCode < 300) {
                // Determine resource_id more intelligently if not in params
                let finalResourceId = resourceId;

                // If the response body has an id (e.g. from POST), use that
                if (!finalResourceId && body) {
                    try {
                        const parsedBody = typeof body === 'string' ? JSON.parse(body) : body;
                        if (parsedBody && parsedBody.id) {
                            finalResourceId = parsedBody.id;
                        }
                    } catch (e) {
                        // Not JSON or parse failed, stick with URL resourceId
                    }
                }

                // Fire and forget logging
                supabase.from('admin_logs').insert({
                    admin_id: adminId,
                    action,
                    resource_type: resourceType,
                    resource_id: finalResourceId && finalResourceId.length === 36 ? finalResourceId : null, // Ensure UUID format
                    new_value: req.body,
                    ip_address: req.ip,
                    user_agent: req.get('User-Agent'),
                    created_at: new Date().toISOString()
                }).then(({ error }) => {
                    if (error) logger.error('Failed to log admin action to DB:', error);
                }).catch(err => {
                    logger.error('Error logging admin action:', err);
                });
            }

            return originalSend.apply(res, arguments as any);
        };
    }
    next();
};
