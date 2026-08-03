import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { pool } from '../config/database';
import { conflict, fail } from '../utils/api-response';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => `${JSON.stringify(key)}:${stableJson(val)}`)
    .join(',')}}`;
}

function requestHash(req: Request) {
  return crypto
    .createHash('sha256')
    .update(req.method)
    .update('|')
    .update(req.originalUrl.split('?')[0])
    .update('|')
    .update(stableJson(req.body || {}))
    .digest('hex');
}

function getKey(req: Request) {
  const raw = req.headers['idempotency-key'];
  const explicitKey = Array.isArray(raw) ? raw[0] : raw;
  if (explicitKey) return explicitKey;

  const githubDelivery = req.headers['x-github-delivery'];
  if (githubDelivery) {
    return `github:${Array.isArray(githubDelivery) ? githubDelivery[0] : githubDelivery}`;
  }

  const razorpayEvent = req.headers['x-razorpay-event-id'];
  if (razorpayEvent) {
    return `razorpay:${Array.isArray(razorpayEvent) ? razorpayEvent[0] : razorpayEvent}`;
  }

  return undefined;
}

export const requireIdempotencyKey = async (req: Request, res: Response, next: NextFunction) => {
  if (!MUTATING_METHODS.has(req.method)) return next();

  const key = getKey(req);
  if (!key || key.length < 12 || key.length > 255) {
    return fail(res, 428, 'IDEMPOTENCY_KEY_REQUIRED', 'Provide a valid Idempotency-Key header.');
  }

  const hash = requestHash(req);
  const userId = (req as any).user?.id || null;
  const client = await pool.connect();

  try {
    await client.query('begin');
    const inserted = await client.query(
      `
        insert into idempotency_keys (key, request_hash, method, path, user_id, expires_at)
        values ($1, $2, $3, $4, $5, now() + interval '24 hours')
        on conflict (key) do nothing
        returning id, response, status_code
      `,
      [key, hash, req.method, req.originalUrl.split('?')[0], userId]
    );

    if (inserted.rowCount === 0) {
      const existing = await client.query(
        `
          select request_hash, response, status_code
          from idempotency_keys
          where key = $1 and expires_at > now()
          for update
        `,
        [key]
      );
      const row = existing.rows[0];
      if (!row) {
        await client.query('rollback');
        client.release();
        return conflict(res, 'Idempotency key expired. Use a new key.');
      }
      if (row.request_hash !== hash) {
        await client.query('rollback');
        client.release();
        return conflict(res, 'Idempotency key was already used for a different request.');
      }
      if (row.response) {
        await client.query('commit');
        client.release();
        return res.status(row.status_code || 200).json(row.response);
      }
      await client.query('rollback');
      client.release();
      return conflict(res, 'A request with this Idempotency-Key is still processing.');
    }

    await client.query('commit');
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    client.release();
    return next(error);
  }

  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    if (res.statusCode >= 200 && res.statusCode < 500) {
      void pool.query(
        'update idempotency_keys set response = $1, status_code = $2, updated_at = now() where key = $3',
        [body, res.statusCode, key]
      );
    }
    return originalJson(body);
  }) as Response['json'];

  client.release();
  next();
};
