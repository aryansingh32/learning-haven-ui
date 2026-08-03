import { Response } from 'express';

// ──────────────────────────────────────────────────────────
// Standard API response types
// Every endpoint MUST return one of these shapes.
// ──────────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// ──────────────────────────────────────────────────────────
// Success helpers
// ──────────────────────────────────────────────────────────

export const ok = <T>(
  res: Response,
  data: T,
  meta?: ApiSuccess<T>['meta'],
  status = 200,
) => res.status(status).json({ success: true, data, ...(meta && { meta }) });

export const created = <T>(res: Response, data: T) =>
  res.status(201).json({ success: true, data });

export const noContent = (res: Response) => res.status(204).send();

// ──────────────────────────────────────────────────────────
// Error helpers
// ──────────────────────────────────────────────────────────

export const fail = (
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: unknown,
) =>
  res.status(status).json({
    success: false,
    error: { code, message, ...(details && { details }) },
  });

// Convenience wrappers

export const badRequest = (res: Response, message: string, details?: unknown) =>
  fail(res, 400, 'BAD_REQUEST', message, details);

export const unauthorized = (res: Response, message = 'Unauthorized') =>
  fail(res, 401, 'UNAUTHORIZED', message);

export const forbidden = (res: Response, message = 'Forbidden') =>
  fail(res, 403, 'FORBIDDEN', message);

export const notFound = (res: Response, resource: string) =>
  fail(res, 404, 'NOT_FOUND', `${resource} not found`);

export const conflict = (res: Response, message: string) =>
  fail(res, 409, 'CONFLICT', message);

export const unprocessable = (
  res: Response,
  message: string,
  details?: unknown,
) => fail(res, 422, 'UNPROCESSABLE', message, details);

export const serverError = (res: Response) =>
  fail(res, 500, 'INTERNAL_SERVER_ERROR', 'An unexpected error occurred');
