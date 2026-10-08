import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

export const notFound = (what = 'Not found') => new HttpError(404, what);
export const forbidden = (why = 'You do not have access to this.') => new HttpError(403, why);
export const badRequest = (why: string, details?: unknown) => new HttpError(400, why, details);

// Postgres errors that mean "the database refused this on purpose".
const PG_ERRORS: Record<string, [number, string]> = {
  '42501': [403, 'You do not have access to this.'], // RLS / privilege
  '23505': [409, 'That already exists.'],
  '23503': [400, 'That refers to something that does not exist or belongs to another college.'],
  '23514': [400, 'That value is not allowed.'],
  '22P02': [400, 'Invalid identifier.'],
};

export function errorHandler(err: unknown, _req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) return next(err);

  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, ...(err.details ? { details: err.details } : {}) });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Some fields are invalid.', details: err.flatten().fieldErrors });
  }
  const code = (err as { code?: string })?.code;
  if (code && PG_ERRORS[code]) {
    const [status, message] = PG_ERRORS[code];
    // Trigger messages (e.g. "This test is not available to this college") are written for people.
    const pgMessage = (err as { message?: string }).message;
    const useOwn = code === '23514' && pgMessage && !pgMessage.includes('violates');
    return res.status(status).json({ error: useOwn ? pgMessage : message });
  }

  console.error('Unhandled Campus API error:', err);
  return res.status(500).json({ error: 'Something went wrong. Please try again.' });
}
