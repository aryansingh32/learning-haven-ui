/** Small pure helpers for the practice list: safe search text and the daily problem pick. */

/** Letters, digits, spaces and a few code-ish symbols; drops LIKE wildcards and anything PostgREST treats specially. */
export function cleanSearch(raw: unknown): string | undefined {
    if (typeof raw !== 'string') return undefined;
    const s = raw.normalize('NFKC').replace(/[^\p{L}\p{N} +#.-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
    return s.length > 0 ? s : undefined;
}

/** A company name from the query string, or undefined if it isn't a plausible one. */
export function cleanCompany(raw: unknown): string | undefined {
    if (typeof raw !== 'string') return undefined;
    const s = raw.trim();
    return s.length > 0 && s.length <= 60 && /^[\p{L}\p{N} &.'-]+$/u.test(s) ? s : undefined;
}

/** Today's date in India (YYYY-MM-DD): the daily problem turns over at local midnight. */
export function indiaDate(now: Date = new Date()): string {
    return new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);
}

function hash(s: string): number {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
    return h;
}

/**
 * The daily problem for a date. Problems are put in a fixed shuffled order (by a hash of the slug)
 * and the day number walks through it, so every problem comes round once before any repeats,
 * and adding a problem only reshuffles from that day on.
 */
export function pickDaily<T extends { slug: string }>(problems: T[], date: string): T | null {
    if (problems.length === 0) return null;
    const order = [...problems].sort((a, b) => hash(a.slug) - hash(b.slug) || a.slug.localeCompare(b.slug));
    const day = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
    return order[((day % order.length) + order.length) % order.length];
}
