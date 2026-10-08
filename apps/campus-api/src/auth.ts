import { NextFunction, Request, Response } from 'express';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';
import { env } from './env';
import { HttpError } from './errors';

export interface AuthedRequest extends Request {
  userId: string;
}

/** The verified user id that requireUser attached to this request. */
export function userOf(req: Request): string {
  return (req as unknown as AuthedRequest).userId;
}

const issuer = `${env.SUPABASE_URL.replace(/\/+$/, '')}/auth/v1`;
const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
const hsSecret = env.SUPABASE_JWT_SECRET ? new TextEncoder().encode(env.SUPABASE_JWT_SECRET) : null;

/** Verify a Supabase access token locally (ES256 via JWKS, or the legacy HS256 secret). */
export async function verifyAccessToken(token: string): Promise<JWTPayload> {
  const options = { issuer, audience: 'authenticated' };
  const alg = JSON.parse(Buffer.from(token.split('.')[0] ?? '', 'base64url').toString('utf8') || '{}').alg;
  const { payload } = alg === 'HS256' && hsSecret
    ? await jwtVerify(token, hsSecret, options)
    : await jwtVerify(token, jwks, options);
  if (!payload.sub) throw new Error('Token has no subject');
  return payload;
}

export async function requireUser(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return next(new HttpError(401, 'Sign in to continue.'));
  try {
    const payload = await verifyAccessToken(token);
    (req as unknown as AuthedRequest).userId = payload.sub!;
    next();
  } catch {
    next(new HttpError(401, 'Your session has expired. Sign in again.'));
  }
}
