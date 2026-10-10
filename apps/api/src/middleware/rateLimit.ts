import { createHash } from 'crypto';
import rateLimit, { ipKeyGenerator, Options } from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import redis from '../config/redis';
import { env } from '../config/env';

type RateLimitConfig = Partial<Options> & {
  keyPrefix: string;
};

const store = (prefix: string) =>
  new RedisStore({
    prefix: `${env.RATE_LIMIT_REDIS_PREFIX}${prefix}:`,
    sendCommand: (...args: string[]) => (redis as any).call(...args),
  });

const userOrIpKey = (scope: string) => (req: any) => {
  const userId = req.user?.id;
  if (userId) return `${scope}:user:${userId}`;
  return `${scope}:ip:${ipKeyGenerator(req.ip || '127.0.0.1')}`;
};

const createLimiter = ({ keyPrefix, ...options }: RateLimitConfig) =>
  rateLimit({
    standardHeaders: true,
    legacyHeaders: false,
    store: store(keyPrefix),
    message: {
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests. Try again later.',
      },
    },
    ...options,
  });

/**
 * Sign-in/sign-up attempts are counted per account (email) per IP, not per IP alone:
 * a college lab or hostel shares one public IP, and a per-IP limit of 10 would lock
 * the whole class out at exam time. The email is hashed so Redis never holds it.
 */
const authKey = (req: any) => {
  const userId = req.user?.id;
  if (userId) return `auth:user:${userId}`;
  const ip = ipKeyGenerator(req.ip || '127.0.0.1');
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!email) return `auth:ip:${ip}`;
  return `auth:ip:${ip}:acct:${createHash('sha256').update(email).digest('hex').slice(0, 24)}`;
};

export const authRateLimit = createLimiter({
  keyPrefix: 'auth',
  windowMs: 15 * 60 * 1000,
  max: 10, // 10 attempts per 15 minutes per account and IP (or per signed-in user)
  keyGenerator: authKey,
});

/** A ceiling per IP across all accounts, against password spraying; high enough for a full lab. */
export const authIpCeiling = createLimiter({
  keyPrefix: 'auth-ip',
  windowMs: 15 * 60 * 1000,
  max: 300,
  keyGenerator: (req: any) => `auth-ip:${ipKeyGenerator(req.ip || '127.0.0.1')}`,
});

export const otpRateLimit = createLimiter({
  keyPrefix: 'otp',
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: userOrIpKey('otp'),
});

export const writeRateLimit = createLimiter({
  keyPrefix: 'write',
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: userOrIpKey('write'),
});

export const submissionRateLimit = createLimiter({
  keyPrefix: 'submission',
  windowMs: 60 * 60 * 1000,
  max: 30,
  keyGenerator: userOrIpKey('submission'),
});

export const aiRateLimit = createLimiter({
  keyPrefix: 'ai',
  windowMs: 60 * 60 * 1000,
  max: 30,
  keyGenerator: userOrIpKey('ai'),
});

export const webhookRateLimit = createLimiter({
  keyPrefix: 'webhook',
  windowMs: 60 * 1000,
  max: 120,
  keyGenerator: userOrIpKey('webhook'),
});
