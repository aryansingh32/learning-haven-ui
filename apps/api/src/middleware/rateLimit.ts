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

export const authRateLimit = createLimiter({
  keyPrefix: 'auth',
  windowMs: 15 * 60 * 1000,
  max: 10, // 10 auth attempts per 15 minutes per IP/user
  keyGenerator: userOrIpKey('auth'),
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
