import { Request, Response, NextFunction } from 'express';

export interface PaginationQuery {
  page: number;
  limit: number;
  offset: number;
}

// Extend Express Request to include pagination
declare global {
  namespace Express {
    interface Request {
      pagination: PaginationQuery;
    }
  }
}

/**
 * Global pagination middleware.
 *
 * Reads `?page=N&limit=N` from the query string, clamps values,
 * and attaches a `req.pagination` object to the request.
 *
 * HARD LIMIT: Never allows more than 100 items per page.
 */
export const paginate = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const rawLimit = parseInt(req.query.limit as string) || 20;
  const limit = Math.min(rawLimit, 100); // HARD LIMIT — never allow > 100
  const offset = (page - 1) * limit;

  req.pagination = { page, limit, offset };
  next();
};
