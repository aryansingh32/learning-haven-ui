import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL;

export const apprenticeshipCache = redisUrl
  ? new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      lazyConnect: true,
    })
  : null;

export const apprenticeshipCacheKeys = {
  programsList: 'apprenticeship:programs:list',
  programDetail: (slug: string) => `apprenticeship:programs:${slug}`,
  leaderboard: (programId: string, type: string) => `apprenticeship:leaderboard:${programId}:${type}`,
  analyticsOverview: 'apprenticeship:analytics:overview',
  userEnrollments: (userId: string) => `apprenticeship:user:${userId}:enrollments`,
};

export async function getCachedJson<T>(key: string): Promise<T | null> {
  if (!apprenticeshipCache) return null;
  try {
    if (apprenticeshipCache.status === 'wait') {
      await apprenticeshipCache.connect();
    }
    const raw = await apprenticeshipCache.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function setCachedJson(key: string, value: unknown, ttlSeconds: number) {
  if (!apprenticeshipCache) return;
  try {
    if (apprenticeshipCache.status === 'wait') {
      await apprenticeshipCache.connect();
    }
    await apprenticeshipCache.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch {
    return;
  }
}

export async function clearApprenticeshipCache(...keys: string[]) {
  if (!apprenticeshipCache || keys.length === 0) return;
  try {
    if (apprenticeshipCache.status === 'wait') {
      await apprenticeshipCache.connect();
    }
    await apprenticeshipCache.del(...keys);
  } catch {
    return;
  }
}
