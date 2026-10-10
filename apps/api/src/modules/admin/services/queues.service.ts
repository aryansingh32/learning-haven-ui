import { Queue } from 'bullmq';
import redis from '../../../config/redis';

/**
 * Background job queues (BullMQ), for the admin's Queues view: how many jobs are
 * waiting, running, delayed, failed and done, the latest failures, and retrying,
 * clearing or pausing a queue.
 */

export const QUEUES: { name: string; label: string; deadLetter?: boolean }[] = [
    { name: 'apprenticeship-verification', label: 'Apprenticeship project checks' },
    { name: 'build-verification', label: 'Build challenge checks' },
    { name: 'monetization', label: 'Referrals and subscriptions' },
    { name: 'apprenticeship-verification-dlq', label: 'Apprenticeship checks that gave up', deadLetter: true },
    { name: 'build-verification-dlq', label: 'Build checks that gave up', deadLetter: true },
];

const queues = new Map<string, Queue>();
function queue(name: string): Queue {
    if (!QUEUES.some((q) => q.name === name)) throw Object.assign(new Error('Unknown queue'), { status: 404 });
    let q = queues.get(name);
    if (!q) {
        q = new Queue(name, { connection: redis as any });
        queues.set(name, q);
    }
    return q;
}

const STATES = ['waiting', 'active', 'delayed', 'failed', 'completed', 'paused'] as const;

export const QueuesService = {
    async overview() {
        return Promise.all(QUEUES.map(async (meta) => {
            const q = queue(meta.name);
            const [counts, paused] = await Promise.all([q.getJobCounts(...STATES), q.isPaused()]);
            return { ...meta, paused, counts };
        }));
    },

    /** The latest jobs in one state (failures first by default), without big payloads. */
    async jobs(name: string, state: 'failed' | 'waiting' | 'active' | 'delayed' | 'completed' = 'failed', limit = 25) {
        const jobs = await queue(name).getJobs([state], 0, Math.min(limit, 100) - 1, false);
        return jobs.filter(Boolean).map((j) => ({
            id: j.id,
            name: j.name,
            attempts: j.attemptsMade,
            failedReason: j.failedReason ? String(j.failedReason).slice(0, 500) : null,
            createdAt: j.timestamp ? new Date(j.timestamp).toISOString() : null,
            finishedAt: j.finishedOn ? new Date(j.finishedOn).toISOString() : null,
            data: summarize(j.data),
        }));
    },

    async retry(name: string, jobId?: string) {
        const q = queue(name);
        if (jobId) {
            const job = await q.getJob(jobId);
            if (!job) throw Object.assign(new Error('Job not found'), { status: 404 });
            await job.retry('failed');
            return { retried: 1 };
        }
        const failed = await q.getJobs(['failed'], 0, 999);
        await Promise.all(failed.filter(Boolean).map((j) => j.retry('failed').catch(() => undefined)));
        return { retried: failed.length };
    },

    /** Remove finished jobs of one state (never waiting or running ones). */
    async clean(name: string, state: 'failed' | 'completed') {
        const removed = await queue(name).clean(0, 10_000, state);
        return { removed: removed.length };
    },

    async setPaused(name: string, paused: boolean) {
        const q = queue(name);
        if (paused) await q.pause(); else await q.resume();
        return { paused };
    },
};

/** Job data for display: ids and short values only. */
function summarize(data: unknown): Record<string, unknown> {
    if (!data || typeof data !== 'object') return {};
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data as Record<string, unknown>).slice(0, 12)) {
        if (/token|secret|password|key/i.test(k)) continue;
        out[k] = typeof v === 'string' ? v.slice(0, 120) : typeof v === 'number' || typeof v === 'boolean' || v === null ? v : '…';
    }
    return out;
}
