import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import logger from '../config/logger';

export type VerifiedSupabaseUser = {
  id: string;
  email?: string;
  role?: string;
};

/** Verify a Supabase access token locally (JWKS ES256 or legacy HS256 secret). */
export function verifySupabaseAccessToken(token: string): VerifiedSupabaseUser | null {
  const jwksRaw = process.env.SUPABASE_JWT_JWKS;
  if (jwksRaw) {
    try {
      const jwks = JSON.parse(jwksRaw) as { keys?: Array<Record<string, string>> };
      const jwk = jwks.keys?.[0];
      if (jwk?.kty === 'EC' && jwk.x && jwk.y) {
        const publicKey = crypto.createPublicKey({
          key: {
            kty: 'EC',
            crv: jwk.crv || 'P-256',
            x: jwk.x,
            y: jwk.y,
          },
          format: 'jwk',
        });
        const decoded = jwt.verify(token, publicKey, { algorithms: ['ES256'] }) as {
          sub?: string;
          email?: string;
          role?: string;
        };
        if (decoded?.sub) {
          return { id: decoded.sub, email: decoded.email, role: decoded.role };
        }
      }
    } catch (err) {
      logger.debug('SUPABASE_JWT_JWKS verification failed', err);
    }
  }

  const secret = process.env.SUPABASE_JWT_SECRET;
  if (secret) {
    try {
      const decoded = jwt.verify(token, secret) as {
        sub?: string;
        email?: string;
        role?: string;
      };
      if (decoded?.sub) {
        return { id: decoded.sub, email: decoded.email, role: decoded.role };
      }
    } catch (err) {
      logger.debug('SUPABASE_JWT_SECRET verification failed', err);
    }
  }

  return null;
}
