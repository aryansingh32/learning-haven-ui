import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { unprocessable } from '../utils/api-response';

/**
 * Zod validation middleware.
 *
 * Supports two patterns:
 *
 * 1. **Single-source** (recommended for new code):
 *    ```
 *    const bodySchema = z.object({ email: z.string().email() });
 *    router.post('/thing', validate(bodySchema), controller);
 *    router.get('/things', validate(querySchema, 'query'), controller);
 *    ```
 *
 * 2. **Combined** (legacy — wraps body/query/params together):
 *    ```
 *    const schema = z.object({
 *      body: z.object({ ... }),
 *      query: z.object({ ... }),
 *      params: z.object({ ... }),
 *    });
 *    router.post('/thing', validate(schema), controller);
 *    ```
 *    The middleware auto-detects combined schemas by checking for
 *    body/query/params keys in the schema shape.
 *
 * On failure returns 422 with structured validation errors.
 */
export const validate =
  (schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') =>
  (req: Request, res: Response, next: NextFunction) => {
    // Auto-detect whether this is a combined schema (has body/query/params keys)
    const isCombinedSchema = 
      schema && 
      (schema as any).shape && 
      Object.keys((schema as any).shape).some(k => ['body', 'query', 'params'].includes(k));

    if (isCombinedSchema) {
      const combined = { body: req.body, query: req.query, params: req.params };
      const result = schema.safeParse(combined);
      
      if (!result.success) {
        const issues = (result as any).error.issues || (result as any).error.errors || [];
        const details = issues.map((e: any) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        return unprocessable(res, 'Validation failed', details);
      }
      
      if ((result as any).data.body) req.body = (result as any).data.body;
      if ((result as any).data.query) (req as any).query = (result as any).data.query;
      if ((result as any).data.params) req.params = (result as any).data.params;
      return next();
    }

    // Single-source pattern
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const issues = (result as any).error.issues || (result as any).error.errors || [];
      const details = issues.map((e: any) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      return unprocessable(res, 'Validation failed', details);
    }
    // Replace with parsed + coerced data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any)[source] = result.data;
    next();
  };
