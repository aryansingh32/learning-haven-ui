import { AsyncLocalStorage } from 'async_hooks';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

interface RequestContext {
    requestId: string;
    userId?: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

export const requestTracer = (req: Request, res: Response, next: NextFunction) => {
    const requestId = (req.headers['x-request-id'] as string) || randomUUID();
    
    const context: RequestContext = { requestId };
    
    // Attach to request
    (req as any).requestId = requestId;
    
    // Set response header
    res.setHeader('X-Request-Id', requestId);
    
    requestContext.run(context, () => {
        next();
    });
};
